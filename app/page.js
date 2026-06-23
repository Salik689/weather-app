"use client";

import { useEffect, useState } from "react";

export default function Home() {
  // City input from the user
  const [city, setCity] = useState("");

  // Current weather for the selected location
  const [weather, setWeather] = useState(null);

  // Current 7-day forecast data
  const [weeklyWeather, setWeeklyWeather] = useState(null);

  // Request state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Theme for background styling
  const [theme, setTheme] = useState("default");

  // Geolocation permission state
  const [locationAllowed, setLocationAllowed] = useState(null);

  // Copy-to-clipboard feedback state
  const [copiedCity, setCopiedCity] = useState(null);

  async function getUserLocation() {

    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }

    setLoading(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {

        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        try {

          // 1. Get weather
          const weatherRes = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
          );

          const weatherData = await weatherRes.json();
          const w = weatherData.current_weather;

          // 2. Get CITY NAME (IMPORTANT FIX)
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
          );

          const geoData = await geoRes.json();

          const cityName =
            geoData.address.city ||
            geoData.address.town ||
            geoData.address.village ||
            geoData.address.county ||
            "Unknown location";

          await getWeeklyForecast(lat, lon);
          setTheme(getTheme(w.weathercode));
          setCity(cityName);
          setWeather({
            name: cityName,   // ✅ REAL CITY NAME
            temp: w.temperature,
            wind: w.windspeed,
            condition: conditions[w.weathercode] || "Unknown",
            gear: getGear(w.weathercode, w.temperature),
          });
          setLocationAllowed(true);
        } catch (err) {
          console.log(err);
          setError("Failed to get location");
        }

        setLoading(false);
      },

      (err) => {
        setLocationAllowed(false);
        console.log(err);
        setError("Location permission denied");
        setLoading(false);
      }
    );
  }


  useEffect(() => {

    getUserLocation();

  }, []);


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

  // Determine recommended clothing. Prefer temperature-based suggestions
  // when a temperature is available (handles extreme places like Antarctica).
  function getGear(code, temp) {
    // If we have a numeric temperature, prioritize it for recommendations
    if (typeof temp === "number" && !Number.isNaN(temp)) {
      if (temp <= -20)
        return "❄️ Extreme cold — heavy parka, insulated layers, balaclava, extreme-cold gear";
      if (temp <= 0) return "❄️ Very cold — heavy coat, insulated boots, gloves, hat";
      if (temp <= 5) return "🧥 Cold — warm coat, layers, hat and gloves";
      if (temp <= 12) return "🧣 Cool — light coat or sweater and layers";
      if (temp <= 20) return "🧥 Mild — long-sleeve or light jacket";
      if (temp <= 28) return "☀️ Warm — T-shirt, light layers, sunscreen";
      if (temp >= 35) return "🔥 Heat alert — very light clothing, stay hydrated, avoid midday sun";
      return "☀️ Comfortable — light clothing and a layer";
    }

    // Fallback to weather code heuristics when temperature isn't available
    if (code === 0) return "☀️ Sunny — T-shirt, sunglasses, sunscreen";
    if ([1, 2].includes(code)) return "🌤️ Light layers — long-sleeve or light jacket";
    if (code === 3) return "⛅ Mild — light sweater or shirt";
    if ([45].includes(code)) return "🌫️ Fog — wear high-visibility or reflective layers";
    if ([51, 61, 63, 65].includes(code))
      return "🌧️ Rain — waterproof jacket, umbrella, water-resistant shoes";
    if ([71, 73, 75].includes(code))
      return "❄️ Snow — warm coat, insulated boots, gloves, hat";
    if (code === 95) return "⛈️ Storm — avoid travel, stay indoors if possible";
    return "👕 Check local conditions and dress in layers";
  }

  function getWeekday(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { weekday: "long" });
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
      await getWeeklyForecast(latitude, longitude);

      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
      );

      const data = await res.json();
      const w = data.current_weather;
      console.log("w: ", data.current_weather)

      setTheme(getTheme(w.weathercode));

      setWeather({
        name,
        temp: w.temperature,
        wind: w.windspeed,
        condition: conditions[w.weathercode] || "Unknown",
        gear: getGear(w.weathercode, w.temperature),
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
    sunny: "bg-gradient-to-br from-yellow-200 via-yellow-400 to-orange-500",
    cloudy: "bg-gradient-to-br from-slate-500 via-gray-600 to-gray-800",
    fog: "bg-gradient-to-br from-stone-400 via-gray-500 to-slate-700",
    rain: "bg-gradient-to-br from-indigo-900 via-blue-800 to-sky-700",
    snow: "bg-gradient-to-br from-blue-50 via-sky-100 to-cyan-200",
    storm: "bg-gradient-to-br from-purple-900 via-gray-900 to-black",
    default: "bg-gradient-to-br from-slate-900 via-gray-800 to-slate-700",
  };


async function getWeeklyForecast(lat, lon) {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`
    );

    const data = await res.json();

    if (!data.daily) return;

    setWeeklyWeather({
      time: data.daily.time,
      max: data.daily.temperature_2m_max,
      min: data.daily.temperature_2m_min,
      code: data.daily.weather_code,
    });

  } catch (err) {
    console.log("Weekly error:", err);
  }
}


  return (

    <div className={`min-h-screen pt-20 flex flex-col items-center justify-between text-white ${bg[theme]} p-6`}>

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
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                getWeather();
              }
            }}
            placeholder="Enter city..."
            className="border-2 border-blue-500 flex-1 text-white px-4 py-2 rounded-lg text-black outline-none"
          />

          <button
            onClick={() => getWeather()}
            className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg transition"
          >
            {loading ? "..." : "Go"}
          </button>
        </div>

      </header>


      {/* MAIN */}
      <div className="flex-1 flex items-center flex-col justify-center w-full">

        <div className="w-full flex justify-center items-center max-w-md bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-2xl">
          {locationAllowed !== true && (
            <button
              onClick={getUserLocation}
              className="mt-3 px-4 py-2 rounded-xl bg-white/10 border border-white/20 hover:bg-white/20 transition"
            >
              📍 Use My Location
            </button>
          )}



          {/* WEATHER */}
          {weather && (
            <div className="mt-8 text-center">

              {/* City */}
              <h1 className="text-5xl md:text-6xl font-light tracking-tight">
                {weather.name}

              </h1>

              {/* Temperature */}
              <div className="text-[90px] md:text-[110px] font-thin leading-none mt-2">
                {Math.round(weather.temp)}°
              </div>

              {/* Condition */}
              <p className="text-xl text-white/80 mt-2">
                {weather.condition}
              </p>

              {/* High / Low (optional for now) */}
              {/* <p className="text-lg text-white/70">
      H: 21° &nbsp; L: 14°
    </p> */}

              {/* Extra stats */}
              <div className="
      mt-8
      grid grid-cols-2 gap-4
      max-w-sm mx-auto
    ">

                <div className="
        bg-white/10
        backdrop-blur-xl
        border border-white/20
        rounded-2xl
        p-5
      ">
                  <p className="text-sm text-white/60">
                    Wind
                  </p>

                  <p className="text-3xl font-semibold mt-1">
                    {weather.wind}
                  </p>

                  <p className="text-sm text-white/60">
                    km/h
                  </p>
                </div>

                <div className="
        bg-white/10
        backdrop-blur-xl
        border border-white/20
        rounded-2xl
        p-5
      ">
                  <p className="text-sm text-white/60">
                    Appropriate outfit?
                  </p>

                  <p className="text-sm mt-2">
                    {weather.gear}
                  </p>
                </div>

              </div>

            </div>
          )}

        </div>
        {weeklyWeather && (
          <div className="mt-8 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-3">7 Day Forecast</h2>

            <div className="space-y-2">
              {weeklyWeather.time.map((day, i) => (
                <div
                  key={i}
                  className="flex justify-between bg-white/10 p-3 rounded-xl"
                >
                  <span>{getWeekday(day)}</span>

                  <div className="text-right">
                    <div>
                      Max {Math.round(weeklyWeather.max[i])}° / Min {Math.round(weeklyWeather.min[i])}°
                    </div>

                    <div className="text-xs text-white/70">
                      {conditions[weeklyWeather.code[i]] || "Unknown"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ERROR */}
      {error && (
        <p className="text-red-400 text-sm mt-3">{error}</p>
      )}
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