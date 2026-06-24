"use client";

import { useEffect, useState } from "react";

export default function Home() {
  function getTodayISO() {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  }
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
  // Toast visibility for errors and validation messages
  const [toastVisible, setToastVisible] = useState(false);
  // Saved coordinates for the currently selected location
  const [locationCoords, setLocationCoords] = useState(null);
  const [selectedDate, setSelectedDate] = useState(getTodayISO());
  const [selectedDateWeather, setSelectedDateWeather] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Show toast when `error` is set, auto-hide after 4s
  useEffect(() => {
    if (!error) return;
    setToastVisible(true);
    const t = setTimeout(() => {
      setToastVisible(false);
      setError("");
    }, 4000);
    return () => clearTimeout(t);
  }, [error]);

  // Sanitize city input: allow letters (unicode), spaces, commas, periods, apostrophes and hyphens
  const sanitizeCityInput = (str) => {
    try {
      return str.replace(/[^\p{L}\s,.'-]/gu, "");
    } catch (e) {
      // Fallback for environments without \p Unicode support: basic Latin + accents range
      return str.replace(/[^A-Za-z\u00C0-\u024F\s,.'-]/g, "");
    }
  };

  const handleCityChange = (e) => {
    const raw = e.target.value;
    const clean = sanitizeCityInput(raw);
    if (raw !== clean) {
      setError("Only letters, spaces, commas, apostrophes and hyphens allowed");
    }
    setCity(clean);
  };

  const handleCityPaste = (e) => {
    e.preventDefault();
    const paste = (e.clipboardData || window.clipboardData).getData("text");
    const clean = sanitizeCityInput(paste);
    setCity(clean);
    if (paste !== clean) {
      setError("Pasted text contained invalid characters and was cleaned");
    }
  };

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
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code`
          );
          const weatherData = await weatherRes.json();
          const w = weatherData.current;

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
          setTheme(getThemeWithTemp(
            w.weather_code,
            w.temperature_2m
          ));
          setLocationCoords({ latitude: lat, longitude: lon });
          setCity(cityName);

          setWeather({
            name: cityName,
            temp: w.temperature_2m,
            feelsLike: w.apparent_temperature,
            humidity: w.relative_humidity_2m,
            wind: w.wind_speed_10m,
            condition: conditions[w.weather_code] || "Unknown",
            gear: getGear(w.weather_code, w.temperature_2m),
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
    // legacy single-arg kept for safety
    return getThemeWithTemp(code, undefined);
  }
  function getThemeWithTemp(code, temp) {

    if ([61, 63, 65].includes(code)) return "rain";
    if ([71, 73, 75].includes(code)) return "snow";
    if (code === 45) return "fog";
    if (code === 95) return "thunderstorm";

    if (temp >= 40) return "extreme-hot";
    if (temp >= 35) return "very-hot";
    if (temp >= 28) return "hot";
    if (temp >= 20) return "warm";
    if (temp >= 10) return "mild";
    if (temp >= 5) return "cool";
    if (temp >= 0) return "cold";
    if (temp >= -15) return "freezing";

    return "arctic";
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
        setError("Place not found");
        setLoading(false);
        return;
      }
      const { latitude, longitude, name } = geoData.results[0];
      setLocationCoords({ latitude, longitude });
      await getWeeklyForecast(latitude, longitude);

      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code`
      );
      const data = await res.json();
      const w = data.current;

      console.log("w: ", data.current_weather)
      console.log("Temp:", w.temperature_2m);
      console.log("Code:", w.weather_code);
      console.log("Theme:", getThemeWithTemp(w.weather_code, w.temperature_2m));
     setTheme(getThemeWithTemp(
  w.weather_code,
  w.temperature_2m
));

      setWeather({
        name,
        temp: w.temperature_2m,
        feelsLike: w.apparent_temperature,
        humidity: w.relative_humidity_2m,
        wind: w.wind_speed_10m,
        condition: conditions[w.weather_code] || "Unknown",
        gear: getGear(w.weather_code, w.temperature_2m),
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

  // Quick cities with very different typical climates for easy testing
  const quickCities = [
    { name: "Phoenix", note: "Very hot, desert summers" },
    { name: "Reykjavik", note: "Cold, maritime subarctic" },
    { name: "Singapore", note: "Hot and humid, tropical" },
    { name: "McMurdo Station", note: "Extremely cold, Antarctic" },
    { name: "Moscow", note: "Cold winters, continental" },
    { name: "Sydney", note: "Mild, temperate" },
  ];

  const bg = {
    "extreme-hot":
      "bg-gradient-to-br from-red-700 via-red-600 to-orange-600",

    "very-hot":
      "bg-gradient-to-br from-red-500 via-orange-500 to-orange-400",

    hot:
      "bg-gradient-to-br from-orange-500 via-orange-400 to-amber-400",

    warm:
      "bg-gradient-to-br from-amber-400 via-yellow-300 to-yellow-200",

    mild:
      "bg-gradient-to-br from-cyan-400 via-sky-400 to-blue-500",

    cool:
      "bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-600",

    cold:
      "bg-gradient-to-br from-blue-700 via-indigo-700 to-indigo-900",

    freezing:
      "bg-gradient-to-br from-cyan-100 via-blue-200 to-blue-500",

    arctic:
      "bg-gradient-to-br from-white via-cyan-100 to-sky-300",

    rain:
      "bg-gradient-to-br from-slate-700 via-blue-800 to-slate-900",

    storm:
      "bg-gradient-to-br from-gray-900 via-purple-900 to-black",

    snow:
      "bg-gradient-to-br from-white via-sky-100 to-cyan-200",

    cloudy:
      "bg-gradient-to-br from-gray-400 via-slate-500 to-gray-700",

    fog:
      "bg-gradient-to-br from-stone-300 via-gray-400 to-slate-600",

    default:
      "bg-gradient-to-br from-slate-900 via-gray-800 to-slate-700",
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

  async function getHistoricalWeather(lat, lon, date) {
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${date}&end_date=${date}&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`
      );

      const data = await res.json();
      if (!data.daily) {
        throw new Error("No historical weather available");
      }
      return {
        date: data.daily.time[0],
        max: data.daily.temperature_2m_max[0],
        min: data.daily.temperature_2m_min[0],
        code: data.daily.weather_code[0],
      };
    } catch (err) {
      console.log("Historical weather error:", err);
      throw err;
    }
  }

  async function handleDateSelection() {
    if (!locationCoords) {
      setError("Search a city or use location first");
      return;
    }

    setHistoryLoading(true);
    setError("");
    setSelectedDateWeather(null);

    try {
      const result = await getHistoricalWeather(
        locationCoords.latitude,
        locationCoords.longitude,
        selectedDate
      );
      setSelectedDateWeather(result);
    } catch (err) {
      setError("Unable to load weather for that date");
    }

    setHistoryLoading(false);
  }


  return (

    <div className={`min-h-screen pt-20 flex flex-col items-center justify-between text-black ${bg[theme]} p-6`}>

      <header className=' backdrop-blur-md bg-white/10 shadow-md justify-between ' >
        <div className="logo">
          <a
            href="/"
            className="
      flex items-center gap-2
      text-2xl sm:text-3xl font-extrabold
      tracking-tight
      select-none
      group
    "
          >
            <span className="text-3xl sm:text-4xl group-hover:rotate-12 transition-transform duration-300">
              ☁️
            </span>

            <span className="
      bg-gradient-to-r
      from-sky-400
      via-cyan-300
      to-blue-500
      bg-clip-text
      hidden
      sm:block
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
            onChange={handleCityChange}
            onPaste={handleCityPaste}
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
              <p className="text-slate-700">
                Feels like {Math.round(weather.feelsLike)}°
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
                  <p className="text-sm text-slate-600">
                    Wind
                  </p>

                  <p className="text-3xl font-semibold mt-1">
                    {weather.wind}
                  </p>

                  <p className="text-sm text-white/60">
                    km/h
                  </p>
                </div>
                <div
                  className="
    bg-white/10
    backdrop-blur-xl
    border border-white/20
    rounded-2xl
    p-5
  "
                >
                  <p className="text-sm text-slate-600">
                    Humidity
                  </p>

                  <p className="text-3xl font-semibold mt-1">
                    {weather.humidity}%
                  </p>
                </div>
                <div className="
        bg-white/10
        backdrop-blur-xl
        border border-white/20
        rounded-2xl
        p-5
      ">
                  <p className="text-sm text-slate-600">
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

                    <div className="text-xs text-slate-600">
                      {conditions[weeklyWeather.code[i]] || "Unknown"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-8 w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-2xl">
          <h2 className="text-lg font-semibold mb-3">Pick a date</h2>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-700">
              Select a date from the calendar to view historical weather for the current location.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="date"
                id="=date"
                value={selectedDate}
                max={getTodayISO()}
                onChange={(e) => setSelectedDate(e.target.value)}
                className=" border-2 border-blue-500 rounded-lg px-4 py-2 text-black"
              />
              <button
                onClick={handleDateSelection}
                className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg transition"
                disabled={historyLoading}
              >
                {historyLoading ? "Loading..." : "Show weather"}
              </button>
            </div>
            {selectedDateWeather && (
              <div className="mt-4 bg-white/10 border border-white/20 rounded-2xl p-4">
                <p className="text-sm text-white/70">
                  Historical weather for {selectedDateWeather.date}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-2xl p-3">
                    <p className="text-xs text-slate-600">High</p>
                    <p className="text-2xl font-semibold">{Math.round(selectedDateWeather.max)}°</p>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-3">
                    <p className="text-xs text-slate-600">Low</p>
                    <p className="text-2xl font-semibold">{Math.round(selectedDateWeather.min)}°</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-700">
                  {conditions[selectedDateWeather.code] || "Unknown"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ERROR TOAST (replaces inline error paragraph) */}
      {toastVisible && (
        <div className="fixed inset-x-0 bottom-4 z-50 flex justify-end px-4 pointer-events-none">
          <div className="bg-red-600/95 text-black px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-sm pointer-events-auto">
            <div className="flex-1 text-sm">{error}</div>
            <button
              onClick={() => {
                setToastVisible(false);
                setError("");
              }}
              aria-label="Dismiss"
              className="text-slate-900 hover:text-slate-800"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {/* QUICK CITIES: clickable examples with typical climate notes */}
      <div className="w-full max-w-md mt-6">
        <h3 className="text-center text-sm text-slate-700 mb-3">Don't have places in mind? Try these.</h3>

        <div className="flex flex-wrap justify-center gap-2">
          {quickCities.map((c) => (
            <div
              key={c.name}
              className="bg-white/10 border border-white/20 px-3 py-2 rounded-lg text-sm flex items-center gap-3"
            >
              <div className="flex flex-col text-left">
                <button
                  onClick={() => getWeather(c.name)}
                  className="hover:underline text-black"
                >
                  {c.name}
                </button>
                <span className="text-xs text-slate-600">{c.note}</span>
              </div>

              <button
                onClick={() => copyCity(c.name)}
                className="text-xs bg-black/30 px-2 py-1 rounded"
              >
                {copiedCity === c.name ? "Copied ✓" : "Copy"}
              </button>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}