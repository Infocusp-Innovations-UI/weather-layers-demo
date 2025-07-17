import { map as Lmap, tileLayer } from "leaflet";
import "leaflet/dist/leaflet.css";
import * as WeatherLayers from "weatherlayers-gl";
import { LeafletLayer } from "deck.gl-leaflet";
import { MapView } from "@deck.gl/core";
import { ClipExtension } from "@deck.gl/extensions";
import { TemperaturePalette, RainPalette } from "./themePalettes";

const initialView = { lat: 20.5937, lng: 78.9629, zoom: 3 };
const bounds = [-180, -85.051129, 180, 85.051129];
const clipBounds = [-181, -85.051129, 181, 85.051129];

let currentLayerType = "temp";

let currentDatetime;

let files = [];

async function getLayer() {
  const isTemp = currentLayerType == 'temp';
  const bandName = isTemp ? "2m_temperature" : "total_precipitation_6hr"
  const params = new URLSearchParams(window.location.search);
  const dateString = params.get('date');
  const date = new Date(dateString);
  const epochSeconds = Math.floor(date.getTime() / 1000);
  const url = `https://zarrvisapi-dot-anthromet-staging.uk.r.appspot.com/generate_png?band_name=${bandName}&timestamp=${epochSeconds}`
  const response = await fetch(url, {credentials: "include", method: 'GET'});
  const data = await response.json();
  
  return data
}

const imageCache = {};

async function fetchAndProcessImage(url) {
  // 1. Fetch image as blob
  if (imageCache[url]) {
    console.log('Using cached image');
    return imageCache[url];
  }
  const res = await fetch(url, { method: 'GET', credentials: 'include' });
  const blob = await res.blob();

  // 2. Create an image object from the blob
  const img = await createImageBitmap(blob);

  // 3. Draw image on canvas
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  // 4. Extract pixel data
  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  const { data, width, height } = imageData; // `data` is a Uint8ClampedArray of RGBA values

  // 5. Optional: convert to Float32Array if needed
  const floatData = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) {
      floatData[i] = data[i] / 255; // Normalize to [0,1] if desired
  }
  
  imageCache[url] = { data: new Uint8ClampedArray(data), width, height };

  return { data: new Uint8ClampedArray(data), width, height };
}

async function getWind() {
  // let res = await fetch("https://zarrvisapi-dot-anthromet-staging.uk.r.appspot.com/image/weathernext_pngs/2m_temperature/1747785600/1747807200.png", {
  //     method: 'GET',
  //     credentials: 'include'
  // });
  // let txt = await res.text()
  // console.log(txt);

  const params = new URLSearchParams(window.location.search);
  const dateString = params.get('date');
  const date = new Date(dateString);
  const epochSeconds = Math.floor(date.getTime() / 1000);
  const url = `https://zarrvisapi-dot-anthromet-staging.uk.r.appspot.com/generate_png?band_name=10m_u_component_of_wind,10m_v_component_of_wind&timestamp=${epochSeconds}`
  const response = await fetch(url, {credentials: "include", method: 'GET'});
  const data = await response.json();
  
  return data
}

async function getImages() {
  //  fetch temp or rain.
  const response = await getLayer()
  // const response = {
  //   "tzero": 1721115960, 
  //   images: ["http://localhost:5173" + "/temp_images/band_name.tzero.1752645600.png", 
  //           "http://localhost:5173" + "/temp_images/band_name.tzero.1752667200.png",
  //           "http://localhost:5173" + "/temp_images/band_name.tzero.1752688800.png",
  //           "http://localhost:5173" + "/temp_images/band_name.tzero.1752710400.png",
  //           "http://localhost:5173" + "/temp_images/band_name.tzero.1752732000.png"]
  // }

  // fetch wind.
  const responseWind = await getWind()
  // const responseWind = {
  //   "tzero": 1721115960, 
  //   images: ["http://localhost:5173" + "/wind_images/band_name.tzero.1752645600.png", 
  //           "http://localhost:5173" + "/wind_images/band_name.tzero.1752667200.png",
  //           "http://localhost:5173" + "/wind_images/band_name.tzero.1752688800.png",
  //           "http://localhost:5173" + "/wind_images/band_name.tzero.1752710400.png",
  //           "http://localhost:5173" + "/wind_images/band_name.tzero.1752732000.png"]
  // }
  
  const windImagesMap = {};
  responseWind.images.forEach(windImage => {
    const imageParts = windImage.split("/");
    const timeStamp = imageParts[imageParts.length - 1].replace(".png", "")
    const date = new Date(timeStamp * 1000);
    const isoString = date.toISOString(); 
    windImagesMap[isoString] = windImage
  })

  const isTemp = currentLayerType === "temp";
  files = response.images.map(image => {
    // const url = isTemp ? "tempUrl" : "rainUrl";
    // const imageParts= image.split("."); // replace with "/" and recheck logic.
    // const timeStamp = imageParts[imageParts.length - 2]
    // const date = new Date(timeStamp * 1000);
    // const isoString = date.toISOString();

    const url = isTemp ? "tempUrl" : "rainUrl";
    const imageParts = image.split("/");
    const timeStamp = imageParts[imageParts.length - 1].replace(".png", "")
    const date = new Date(timeStamp * 1000);
    const isoString = date.toISOString();

    return {
      datetime: isoString,
      [url]: image,
      'windUrl': windImagesMap[isoString]
    }
  })
}

await getImages()

const hourlyDatetimes = [];
const start_dt = new Date(files[0].datetime);
const end_dt = new Date(files[files.length - 1].datetime);
for (let d = new Date(start_dt); d <= end_dt; d.setUTCHours(d.getUTCHours() + 1)) {
  hourlyDatetimes.push(d.toISOString());
}
currentDatetime = hourlyDatetimes[0];

const map = Lmap(document.getElementById("lmap"), { worldCopyJump: true })
  .fitWorld()
  .setView([initialView.lat, initialView.lng], initialView.zoom);

const deckLayer = new LeafletLayer({
  views: [new MapView({ repeat: true })],
  layers: [],
});
map.addLayer(deckLayer);

map.addLayer(
  tileLayer(
    "https://storage.googleapis.com/weather-next/static_tiles/data_pipeline/basemap/{z}/{x}/{y}.png",
    { maxZoom: 5, minZoom: 0, opacity: 1 },
  ),
);

document.getElementById("tempBtn").addEventListener("click", async () => {
  currentLayerType = "temp";
  toggleActive("tempBtn", "rainBtn");
  await getImages()
  update();
});

document.getElementById("rainBtn").addEventListener("click", async () => {
  currentLayerType = "rain";
  toggleActive("rainBtn", "tempBtn");
  await getImages()
  update();
});

function toggleActive(activeId, inactiveId) {
  document.getElementById(activeId).classList.add("active");
  document.getElementById(activeId).classList.remove("inactive");
  document.getElementById(inactiveId).classList.add("inactive");
  document.getElementById(inactiveId).classList.remove("active");
}

const timelineControl = new WeatherLayers.TimelineControl({
  datetimes: hourlyDatetimes,
  datetime: currentDatetime,
  // onPreload: () =>
  //   Promise.all([
  //     ...files.map(async (f) => await fetchAndProcessImage(f.tempUrl)),
  //     // ...files.map((f) => WeatherLayers.loadTextureData(f.tempUrl, {headers: {credentials: "include", method: "GET"}})),
  //     // ...files.map((f) => WeatherLayers.loadTextureData(f.rainUrl)),
  //   ]),
  onUpdate: async (datetime) => {
    currentDatetime = datetime;
    await update();
  },
});
timelineControl.addTo(document.getElementById("timeline-controls"));

async function update() {
  const datetimes = files.map((f) => f.datetime);
  const startDatetime = WeatherLayers.getClosestStartDatetime(
    datetimes,
    currentDatetime,
  );
  const endDatetime = WeatherLayers.getClosestEndDatetime(
    datetimes,
    currentDatetime,
  );
  const imageWeight = WeatherLayers.getDatetimeWeight(
    startDatetime,
    endDatetime,
    currentDatetime,
  );

  const startFile = files.find((f) => f.datetime === startDatetime);
  const endFile = files.find((f) => f.datetime === endDatetime);

  const isTemp = currentLayerType === "temp";
  const palette = isTemp ? TemperaturePalette : RainPalette;
  const image1Url = isTemp ? startFile.tempUrl : startFile.rainUrl;
  const image2Url = isTemp ? endFile.tempUrl : endFile.rainUrl;

  let [rasterImage1, rasterImage2, windImage1, windImage2] =
    await Promise.all([
      // WeatherLayers.loadTextureData(image1Url, {headers: {credentials: "include", method: "GET"}}),
      // WeatherLayers.loadTextureData(image2Url, {headers: {credentials: "include", method: "GET"}}),
      // WeatherLayers.loadTextureData(startFile.windUrl),
      // WeatherLayers.loadTextureData(endFile.windUrl),
    ]);

  rasterImage1 = await fetchAndProcessImage(image1Url)
  // console.log(rasterImage1)
  rasterImage2 = await fetchAndProcessImage(image2Url)
  // console.log(rasterImage2)
  windImage1 = await fetchAndProcessImage(startFile.windUrl)
  windImage2 = await fetchAndProcessImage(endFile.windUrl)

  const rasterLayer = createRasterLayer(
    rasterImage1,
    rasterImage2,
    imageWeight,
    palette,
    isTemp,
  );

  const windLayer = createWindLayer(windImage1, windImage2, imageWeight);

  const layers = [rasterLayer, windLayer];

  deckLayer.setProps({ layers });
}

function createRasterLayer(img1, img2, weight, palette, isTemp) {
  return new WeatherLayers.RasterLayer({
    id: isTemp ? "temperature-raster" : "rain-raster",
    image: img1,
    image2: img2,
    imageWeight: weight,
    bounds,
    pickable: true,
    palette,
    extensions: [new ClipExtension()],
    clipBounds,
    opacity: isTemp ? 1 : 0.8,
  });
}

function createWindLayer(img1, img2, weight) {
  return new WeatherLayers.ParticleLayer({
    id: "wind",
    image: img1,
    image2: img2,
    imageWeight: weight,
    bounds,
    imageType: "VECTOR",
    imageUnscale: [-127, 128],
    fadeIn: true,
    numParticles: 5000,
    maxAge: 15,
    extensions: [new ClipExtension()],
    clipBounds,
  });
}

await update();