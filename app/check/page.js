"use client";

import { useState } from "react";

export default function Home() {
  const [city, setCity] = useState("");
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState("default");

  // ⭐ NEW: track copied city
  const [copiedCity, setCopiedCity] = useState(null);

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
    if ([3].includes(code)) return "👕 Mild weather clothing";
    if ([45].includes(code)) return "🌫️ Low visibility caution";
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

  const copyCity = (name) => {
    navigator.clipboard.writeText(name);
    setCopiedCity(name);

    setTimeout(() => {
      setCopiedCity(null);
    }, 1500);
  };

  const bg = {
    sunny: "bg-gradient-to-br from-yellow-400 via-orange-400 to-yellow-600",
    cloudy: "bg-gradient-to-br from-gray-600 to-gray-800",
    fog: "bg-gradient-to-br from-gray-500 to-slate-700",
    rain: "bg-gradient-to-br from-gray-900 to-blue-900",
    snow: "bg-gradient-to-br from-blue-200 to-cyan-200",
    storm: "bg-gradient-to-br from-gray-900 via-gray-800 to-black",
    default: "bg-gradient-to-br from-slate-900 to-slate-700",
  };

  const quickCities = [
  "Mawsynram",
  "Cherrapunji",
  "Quibdó",
  "Buenaventura",
  "Cairns",
  "Kuwait",
  "Dubai",
  "Riyadh",
  "Phoenix",
  "Las Vegas",
  "Marrakech",
  "Doha",
  "Oslo",
  "Reykjavik",
  "Moscow",
  "Helsinki",
  "Toronto",
  "Montreal",
  "Ulaanbaatar",
  "London",
  "New York",
  "Tokyo",
  "Paris",
  "Berlin",
  "Singapore",
  "Istanbul",
  "Seoul",
  "Sydney",
  "Hong Kong",
  "San Francisco",
  "Lima",
  "Edinburgh",
  "Valparaíso"
];

  return (
    <div className={`min-h-screen mt-11 flex flex-col items-center justify-between text-white ${bg[theme]} p-6`}>

      {/* MAIN */}
      <div className="flex-1 flex items-center justify-center w-full">

        <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-2xl">

          <h1 className="text-3xl font-bold text-center">
            Weather Dashboard
          </h1>

          <p className="text-center text-sm text-white/70 mt-1 mb-6">
            Live weather + smart outfit suggestions
          </p>

          {/* INPUT */}
          <div className="flex gap-2">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Enter city..."
              className="flex-1 px-4 py-2 rounded-lg text-black outline-none"
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

          {/* WEATHER */}
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

        </div>
      </div>

      {/* QUICK CITIES */}
      {/* <div className="w-full max-w-md mt-6">
  <h3 className="text-center text-sm text-white/70 mb-3">
    Explore global cities
  </h3>

  <div className="flex flex-wrap justify-center gap-2">
    {quickCities.map((c) => (
      <div
        key={c}
        className="bg-white/10 border border-white/20 px-3 py-2 rounded-lg text-sm flex items-center gap-2"
      >
        <button
          onClick={() => getWeather(c)}
          className="hover:underline"
        >
          {c}
        </button>

        <button
          onClick={() => copyCity(c)}
          className="text-xs bg-black/30 px-2 py-1 rounded"
        >
          {copiedCity === c ? "Copied ✓" : "Copy"}
        </button>
      </div>
    ))}
  </div>
</div> */}

    </div>
  );
}