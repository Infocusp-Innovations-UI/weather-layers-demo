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
// let showContours = true;
let currentDatetime;

const now = new Date();
// const start = new Date(
//   Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 6),
// );
// const end = new Date(
//   Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 10),
// );

let files = [];
// for (let d = new Date(start); d <= end; d.setUTCHours(d.getUTCHours() + 6)) {
//   const ts = d.toISOString();
//   const yyyymmdd = ts.slice(0, 10).replace(/-/g, "");
//   const hh = ts.slice(11, 13);
//   const timestamp = `${yyyymmdd}${hh}`;
//   const cacheBust = `?ts>${Date.now()}`;

//   files.push({
//     datetime: ts,
//     tempUrl: `https://storage.googleapis.com/weather-next/static_tiles/raster/temp-tiles/${timestamp}/0/0/0.png${cacheBust}`,
//     rainUrl: `https://storage.googleapis.com/weather-next/static_tiles/raster/rain-tiles/${timestamp}/0/0/0.png${cacheBust}`,
//     windUrl: `https://storage.googleapis.com/weather-next/static_tiles/raster/wind/${timestamp}.png${cacheBust}`,
//   });
// }

async function getImages() {
  // Call API here starts.
  // fetch('https://jsonplaceholder.typicode.com/todos/1')
  //     .then(response => response.json())
  //     .then(json => console.log(json))

  //  Get data for currentLayerType ( temp and rain )
  const response = {
    "tzero": 1721115960, 
    images: ["http://localhost:5173" + "/images/band_name.tzero.1752645600.png", 
            "http://localhost:5173" + "/images/band_name.tzero.1752667200.png",
            "http://localhost:5173" + "/images/band_name.tzero.1752688800.png",
            "http://localhost:5173" + "/images/band_name.tzero.1752710400.png",
            "http://localhost:5173" + "/images/band_name.tzero.1752732000.png"]
  }

  // [
  //   '2025-07-16T06:00:00.000Z', // 1752645600
  //   '2025-07-16T12:00:00.000Z', // 1752667200
  //   '2025-07-16T18:00:00.000Z', // 1752688800
  //   '2025-07-17T00:00:00.000Z', // 1752710400
  //   '2025-07-17T06:00:00.000Z'  // 1752732000
  // ] 

  // fetch and update image of wind.
  const responseWind = {
    "tzero": 1721115960, 
    images: ["http://localhost:5173" + "/wind_images/band_name.tzero.1752645600.png", 
            "http://localhost:5173" + "/wind_images/band_name.tzero.1752667200.png",
            "http://localhost:5173" + "/wind_images/band_name.tzero.1752688800.png",
            "http://localhost:5173" + "/wind_images/band_name.tzero.1752710400.png",
            "http://localhost:5173" + "/wind_images/band_name.tzero.1752732000.png"]
  }
  
  const windImagesMap = {};
  responseWind.images.forEach(windImage => {
    const imageParts= windImage.split("."); // replace with "/" and recheck logic.
    const timeStamp = imageParts[imageParts.length - 2]
    const date = new Date(timeStamp * 1000);
    const isoString = date.toISOString(); 
    windImagesMap[isoString] = windImage
  })

  const isTemp = currentLayerType === "temp";
  files = response.images.map(image => {
    const url = isTemp ? "tempUrl" : "rainUrl";
    const imageParts= image.split("."); // replace with "/" and recheck logic.
    const timeStamp = imageParts[imageParts.length - 2]
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

// document.getElementById("contourToggle").addEventListener("change", (e) => {
//   showContours = e.target.checked;
//   update();
// });

document.getElementById("tempBtn").addEventListener("click", () => {
  currentLayerType = "temp";
  toggleActive("tempBtn", "rainBtn");
  update();
});

document.getElementById("rainBtn").addEventListener("click", () => {
  currentLayerType = "rain";
  toggleActive("rainBtn", "tempBtn");
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
  onPreload: () =>
    Promise.all([
      ...files.map((f) => WeatherLayers.loadTextureData(f.tempUrl)),
      // ...files.map((f) => WeatherLayers.loadTextureData(f.rainUrl)),
    ]),
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
  
  const [rasterImage1, rasterImage2, windImage1, windImage2] =
    await Promise.all([
      WeatherLayers.loadTextureData(image1Url),
      WeatherLayers.loadTextureData(image2Url),
      WeatherLayers.loadTextureData(startFile.windUrl),
      WeatherLayers.loadTextureData(endFile.windUrl),
    ]);

  const rasterLayer = createRasterLayer(
    rasterImage1,
    rasterImage2,
    imageWeight,
    palette,
    isTemp,
  );
  
  // const contourLayer = createContourLayer(
  //   rasterImage1,
  //   rasterImage2,
  //   imageWeight,
  // );
  const windLayer = createWindLayer(windImage1, windImage2, imageWeight);

  const layers = [rasterLayer, windLayer]; //, windLayer
  // if (showContours) layers.splice(1, 0, contourLayer);

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

// function createContourLayer(img1, img2, weight) {
//   return new WeatherLayers.ContourLayer({
//     id: "contour",
//     image: img1,
//     image2: img2,
//     imageWeight: weight,
//     bounds,
//     interval: 0.02,
//     majorInterval: 0.1,
//     width: 2,
//     palette: false,
//     extensions: [new ClipExtension()],
//     clipBounds,
//     opacity: 0.2,
//   });
// }

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
