"use client"
import React from 'react'
import './Navbar.css';
import { useState } from 'react';
import { useRef } from "react";
import Image from 'next/image';


const Navbar = () => {
  const [menu, setmenu] = useState(false)
  const menuRef = useRef(null);
  const [city, setCity] = useState("");
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
const [theme, setTheme] = useState("default");
  const conditions = {
  0: "Clear sky ☀️",
  1: "Mainly clear 🌤️",
  2: "Partly cloudy ⛅",
  3: "Overcast ☁️",
  45: "Fog 🌫️",
  51: "Light rain 🌦️",
  61: "Rain 🌧️",
  71: "Snow ❄️",
  95: "Thunderstorm ⛈️",
};

function getTheme(code) {
  if (code === 0) return "sunny";
  if ([1, 2].includes(code)) return "cloudy";
  if ([3, 45].includes(code)) return "fog";
  if ([51, 61, 63, 65].includes(code)) return "rain";
  if ([71, 73, 75].includes(code)) return "snow";
  if (code === 95) return "storm";
  return "default";
}

function getGear(code) {
  if (code === 0) return "☀️ Light clothing + sunglasses";
  if ([1, 2].includes(code)) return "🧥 Light jacket";
  if (code === 3) return "👕 Mild weather clothing";
  if (code === 45) return "🌫️ Low visibility caution";
  if ([51, 61, 63, 65].includes(code)) return "🌧️ Take an umbrella";
  if ([71, 73, 75].includes(code)) return "❄️ Warm coat + layers";
  if (code === 95) return "⛈️ Stay indoors if possible";
  return "👕 Dress normally";
}
  async function getWeather(customCity) {
    const targetCity = customCity || city;

    if (!targetCity.trim()) {
      setError("Enter a city");
      return;
    }

    setLoading(true);
    setError("");
    setWeather(null);

    try {
      const geo = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${targetCity}&count=1`
      );

      const geoData = await geo.json();

      if (!geoData.results) {
        setError("City not found");
        setLoading(false);
        return;
      }

      const { latitude, longitude, name } = geoData.results[0];

      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
      );

      const data = await res.json();
      const w = data.current_weather;

      setTheme(getTheme(w.weathercode));

      setWeather({
        name,
        temp: w.temperature,
        wind: w.windspeed,
        condition: conditions[w.weathercode] || "Unknown",
        gear: getGear(w.weathercode),
      });

      setCity(name);

    } catch (err) {
      setError("Something went wrong");
    }

    setLoading(false);
  }
  function toggleMenu() {
    setmenu(!menu)
  }
  return (
    <>
      <header className=' backdrop-blur-md bg-white/10 shadow-md justify-between' >
        <div className="logo">
          <a
            href="/"
            className="
      flex items-center gap-2
      text-3xl font-extrabold
      tracking-tight
      select-none
      group
    "
          >
            <span className="text-4xl group-hover:rotate-12 transition-transform duration-300">
              ☁️
            </span>

            <span className="
      bg-gradient-to-r
      from-sky-400
      via-cyan-300
      to-blue-500
      bg-clip-text
      text-transparent
      drop-shadow-sm
    ">
              SkyCast
            </span>
          </a>
        </div>
       {/* INPUT */}
            <div className="flex gap-2 my-20">
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Enter city..."
                className= "border-2 border-blue-500 flex-1 px-4 py-2 rounded-lg text-black outline-none"
              />

              <button
                onClick={() => getWeather()}
                className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg transition"
              >
                {loading ? "..." : "Go"}
              </button>
            </div>

            {/* ERROR */}
            {error && (
              <p className="text-red-400 text-sm mt-3">{error}</p>
            )}
      </header>
      {weather && (
  <div className="mt-6 text-center bg-white/10 p-5 rounded-xl border border-white/20">

    <h2 className="text-xl font-semibold">{weather.name}</h2>
    <p className="mt-1 text-white/80">{weather.condition}</p>

    <div className="flex justify-around mt-4 text-lg">
      <div>🌡️ <br />{weather.temp}°C</div>
      <div>💨 <br />{weather.wind} km/h</div>
    </div>

    <div className="mt-4 p-3 rounded-lg bg-black/20 text-sm">
      <p className="font-semibold">What to wear:</p>
      <p>{weather.gear}</p>
    </div>

  </div>
)}
    </>
  )
}

export default Navbar
