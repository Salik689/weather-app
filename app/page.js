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
    setLocationAllowed(null);

    if (navigator.permissions) {
      try {
        const permission = await navigator.permissions.query({ name: "geolocation" });
        if (permission.state === "denied") {
          setLocationAllowed(false);
          setError(
            "Location access is blocked in your browser. Enable location permission for this site and try again."
          );
          setLoading(false);
          return;
        }
      } catch (permissionErr) {
        console.log("Permission query failed", permissionErr);
      }
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        try {
          const weatherRes = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code`
          );
          const weatherData = await weatherRes.json();
          const w = weatherData.current || weatherData.current_weather;

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
          setTheme(getThemeWithTemp(w.weather_code, w.temperature_2m));
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
          setLocationAllowed(false);
          setError("Failed to get location data");
        }

        setLoading(false);
      },
      (err) => {
        setLocationAllowed(false);
        console.log(err);

        if (err.code === 1) {
          setError(
            "Location permission denied. Enable location access in your browser settings and try again."
          );
        } else if (err.code === 2) {
          setError("Position unavailable. Please try again or check your device settings.");
        } else if (err.code === 3) {
          setError("Location request timed out. Please try again.");
        } else {
          setError("Failed to access location. Please try again.");
        }

        setLoading(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 0,
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
    const rainCodes = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82];
    const snowCodes = [71, 73, 75, 77, 85, 86];
    const stormCodes = [95, 96, 99];
    const fogCodes = [45, 48];
    const cloudyCodes = [3];

    const temperatureTheme = () => {
      if (typeof temp === "number" && !Number.isNaN(temp)) {
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
      return "default";
    };

    if (stormCodes.includes(code)) return "storm";
    if (rainCodes.includes(code)) return "rain";
    if (snowCodes.includes(code)) return "snow";
    if (fogCodes.includes(code)) return "fog";
    if (cloudyCodes.includes(code)) return temperatureTheme();

    return temperatureTheme();
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
const w = data.current || data.current_weather;
          const temp = w?.temperature_2m ?? w?.temperature;
          const code = w?.weather_code ?? w?.weathercode;

      console.log("w: ", w)
      console.log("Temp:", temp);
      console.log("Code:", code);
      console.log("Theme:", getThemeWithTemp(code, temp));
      setTheme(getThemeWithTemp(
  code,
  temp
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
      "bg-gradient-to-br from-red-800 via-orange-600 to-fuchsia-500",

    "very-hot":
      "bg-gradient-to-br from-orange-600 via-amber-400 to-rose-400",

    hot:
      "bg-gradient-to-br from-orange-500 via-orange-400 to-yellow-300",

    warm:
      "bg-gradient-to-br from-orange-300 via-amber-300 to-sky-100",

    mild:
      "bg-gradient-to-br from-sky-300 via-cyan-200 to-white",

    cool:
      "bg-gradient-to-br from-sky-600 via-indigo-600 to-violet-700",

    cold:
      "bg-gradient-to-br from-indigo-800 via-blue-800 to-slate-900",

    freezing:
      "bg-gradient-to-br from-cyan-200 via-slate-300 to-blue-500",

    arctic:
      "bg-gradient-to-br from-sky-100 via-cyan-200 to-blue-400",

    rain:
      "bg-gradient-to-br from-slate-800 via-slate-700 to-blue-900",

    storm:
      "bg-gradient-to-br from-slate-950 via-purple-900 to-black",

    snow:
      "bg-gradient-to-br from-slate-100 via-sky-100 to-cyan-200",

    cloudy:
      "bg-gradient-to-br from-slate-400 via-slate-500 to-slate-600",

    fog:
      "bg-gradient-to-br from-slate-300 via-stone-300 to-slate-400",

    default:
      "bg-gradient-to-br from-blue-50 via-sky-100 to-cyan-100",
  };

  const textColors = {
    "extreme-hot": "text-slate-950",
    "very-hot": "text-slate-950",
    hot: "text-slate-950",
    warm: "text-slate-950",
    mild: "text-slate-950",
    cool: "text-white",
    cold: "text-white",
    freezing: "text-slate-950",
    arctic: "text-slate-950",
    rain: "text-white",
    storm: "text-white",
    snow: "text-slate-950",
    cloudy: "text-white",
    fog: "text-slate-950",
    default: "text-slate-950",
  };

  const isDarkTheme = ["cool", "cold", "rain", "storm", "cloudy"].includes(theme);
  const mutedTextClass = isDarkTheme ? "text-slate-200/85" : "text-slate-700";
  const subtleTextClass = isDarkTheme ? "text-slate-300" : "text-slate-500";
  const cardTextClass = isDarkTheme ? "text-slate-100" : "text-slate-950";
  const cardSubtleTextClass = isDarkTheme ? "text-slate-300" : "text-slate-600";

  function renderBackgroundBlobs(theme) {
    const blobSets = {
      "extreme-hot": [
        {
          key: "extreme-hot-1",
          className: "absolute rounded-full blur-3xl opacity-70 floating-blob slow",
          style: {
            top: "-10%",
            left: "-10%",
            width: "420px",
            height: "420px",
            background:
              "radial-gradient(circle at 25% 25%, rgba(255, 112, 82, 0.45), transparent 55%)",
          },
        },
        {
          key: "extreme-hot-2",
          className: "absolute rounded-full blur-3xl opacity-55 floating-blob medium",
          style: {
            bottom: "-8%",
            right: "-8%",
            width: "340px",
            height: "340px",
            background:
              "radial-gradient(circle at 75% 35%, rgba(251, 191, 36, 0.30), transparent 55%)",
          },
        },
      ],
      "very-hot": [
        {
          key: "very-hot-1",
          className: "absolute rounded-full blur-3xl opacity-70 floating-blob slow",
          style: {
            top: "5%",
            left: "-8%",
            width: "360px",
            height: "360px",
            background:
              "radial-gradient(circle at 20% 20%, rgba(252, 165, 10, 0.45), transparent 55%)",
          },
        },
        {
          key: "very-hot-2",
          className: "absolute rounded-full blur-3xl opacity-55 floating-blob medium",
          style: {
            bottom: "-12%",
            right: "-10%",
            width: "320px",
            height: "320px",
            background:
              "radial-gradient(circle at 80% 25%, rgba(251, 191, 36, 0.30), transparent 55%)",
          },
        },
      ],
      hot: [
        {
          key: "hot-1",
          className: "absolute rounded-full blur-3xl opacity-70 floating-blob slow",
          style: {
            top: "-12%",
            left: "10%",
            width: "380px",
            height: "380px",
            background:
              "radial-gradient(circle at 30% 30%, rgba(255, 166, 56, 0.40), transparent 55%)",
          },
        },
        {
          key: "hot-2",
          className: "absolute rounded-full blur-3xl opacity-55 floating-blob medium",
          style: {
            bottom: "-10%",
            right: "5%",
            width: "320px",
            height: "320px",
            background:
              "radial-gradient(circle at 70% 40%, rgba(251, 146, 60, 0.30), transparent 55%)",
          },
        },
      ],
      warm: [
        {
          key: "warm-1",
          className: "absolute rounded-full blur-3xl opacity-70 floating-blob slow",
          style: {
            top: "-8%",
            left: "-8%",
            width: "400px",
            height: "400px",
            background:
              "radial-gradient(circle at 25% 25%, rgba(56, 189, 248, 0.30), transparent 55%)",
          },
        },
        {
          key: "warm-2",
          className: "absolute rounded-full blur-3xl opacity-50 floating-blob medium",
          style: {
            bottom: "-10%",
            right: "-12%",
            width: "320px",
            height: "320px",
            background:
              "radial-gradient(circle at 75% 30%, rgba(251, 191, 36, 0.25), transparent 55%)",
          },
        },
      ],
      mild: [
        {
          key: "mild-1",
          className: "absolute rounded-full blur-3xl opacity-70 floating-blob slow",
          style: {
            top: "-10%",
            left: "5%",
            width: "380px",
            height: "380px",
            background:
              "radial-gradient(circle at 30% 25%, rgba(96, 165, 250, 0.35), transparent 55%)",
          },
        },
        {
          key: "mild-2",
          className: "absolute rounded-full blur-3xl opacity-50 floating-blob medium",
          style: {
            bottom: "-12%",
            right: "-8%",
            width: "340px",
            height: "340px",
            background:
              "radial-gradient(circle at 75% 30%, rgba(191, 219, 254, 0.25), transparent 55%)",
          },
        },
      ],
      cool: [
        {
          key: "cool-1",
          className: "absolute rounded-full blur-3xl opacity-70 floating-blob slow",
          style: {
            top: "-12%",
            left: "-10%",
            width: "420px",
            height: "420px",
            background:
              "radial-gradient(circle at 20% 20%, rgba(59, 130, 246, 0.40), transparent 55%)",
          },
        },
        {
          key: "cool-2",
          className: "absolute rounded-full blur-3xl opacity-50 floating-blob medium",
          style: {
            bottom: "-10%",
            right: "-10%",
            width: "320px",
            height: "320px",
            background:
              "radial-gradient(circle at 80% 35%, rgba(139, 92, 246, 0.22), transparent 55%)",
          },
        },
      ],
      cold: [
        {
          key: "cold-1",
          className: "absolute rounded-full blur-3xl opacity-70 floating-blob slow",
          style: {
            top: "-10%",
            left: "-8%",
            width: "420px",
            height: "420px",
            background:
              "radial-gradient(circle at 25% 20%, rgba(56, 189, 248, 0.35), transparent 55%)",
          },
        },
        {
          key: "cold-2",
          className: "absolute rounded-full blur-3xl opacity-50 floating-blob medium",
          style: {
            bottom: "-12%",
            right: "-10%",
            width: "340px",
            height: "340px",
            background:
              "radial-gradient(circle at 75% 35%, rgba(99, 102, 241, 0.25), transparent 55%)",
          },
        },
      ],
      freezing: [
        {
          key: "freezing-1",
          className: "absolute rounded-full blur-3xl opacity-65 floating-blob slow",
          style: {
            top: "-8%",
            left: "-8%",
            width: "380px",
            height: "380px",
            background:
              "radial-gradient(circle at 30% 30%, rgba(191, 219, 254, 0.35), transparent 55%)",
          },
        },
        {
          key: "freezing-2",
          className: "absolute rounded-full blur-3xl opacity-45 floating-blob medium",
          style: {
            bottom: "-10%",
            right: "-12%",
            width: "320px",
            height: "320px",
            background:
              "radial-gradient(circle at 70% 35%, rgba(220, 234, 255, 0.30), transparent 55%)",
          },
        },
      ],
      arctic: [
        {
          key: "arctic-1",
          className: "absolute rounded-full blur-3xl opacity-65 floating-blob slow",
          style: {
            top: "-12%",
            left: "-10%",
            width: "420px",
            height: "420px",
            background:
              "radial-gradient(circle at 20% 25%, rgba(186, 230, 253, 0.40), transparent 55%)",
          },
        },
        {
          key: "arctic-2",
          className: "absolute rounded-full blur-3xl opacity-45 floating-blob medium",
          style: {
            bottom: "-10%",
            right: "-8%",
            width: "340px",
            height: "340px",
            background:
              "radial-gradient(circle at 80% 30%, rgba(204, 228, 255, 0.28), transparent 55%)",
          },
        },
      ],
      rain: [
        {
          key: "rain-1",
          className: "absolute rounded-full blur-3xl opacity-70 floating-blob slow",
          style: {
            top: "-10%",
            left: "-8%",
            width: "420px",
            height: "420px",
            background:
              "radial-gradient(circle at 25% 25%, rgba(56, 189, 248, 0.30), transparent 55%)",
          },
        },
        {
          key: "rain-2",
          className: "absolute rounded-full blur-3xl opacity-50 floating-blob medium",
          style: {
            bottom: "-10%",
            right: "-10%",
            width: "340px",
            height: "340px",
            background:
              "radial-gradient(circle at 80% 35%, rgba(148, 163, 184, 0.28), transparent 55%)",
          },
        },
      ],
      storm: [
        {
          key: "storm-1",
          className: "absolute rounded-full blur-3xl opacity-70 floating-blob slow",
          style: {
            top: "-10%",
            left: "-8%",
            width: "420px",
            height: "420px",
            background:
              "radial-gradient(circle at 25% 25%, rgba(139, 92, 246, 0.35), transparent 55%)",
          },
        },
        {
          key: "storm-2",
          className: "absolute rounded-full blur-3xl opacity-50 floating-blob medium",
          style: {
            bottom: "-10%",
            right: "-10%",
            width: "340px",
            height: "340px",
            background:
              "radial-gradient(circle at 80% 35%, rgba(15, 23, 42, 0.28), transparent 55%)",
          },
        },
      ],
      snow: [
        {
          key: "snow-1",
          className: "absolute rounded-full blur-3xl opacity-75 floating-blob slow",
          style: {
            top: "-8%",
            left: "-8%",
            width: "380px",
            height: "380px",
            background:
              "radial-gradient(circle at 30% 25%, rgba(236, 253, 255, 0.45), transparent 55%)",
          },
        },
        {
          key: "snow-2",
          className: "absolute rounded-full blur-3xl opacity-45 floating-blob medium",
          style: {
            bottom: "-12%",
            right: "-10%",
            width: "320px",
            height: "320px",
            background:
              "radial-gradient(circle at 70% 35%, rgba(219, 234, 254, 0.35), transparent 55%)",
          },
        },
      ],
      cloudy: [
        {
          key: "cloudy-1",
          className: "absolute rounded-full blur-3xl opacity-65 floating-blob slow",
          style: {
            top: "-10%",
            left: "-8%",
            width: "420px",
            height: "420px",
            background:
              "radial-gradient(circle at 25% 25%, rgba(148, 163, 184, 0.35), transparent 55%)",
          },
        },
        {
          key: "cloudy-2",
          className: "absolute rounded-full blur-3xl opacity-45 floating-blob medium",
          style: {
            bottom: "-12%",
            right: "-10%",
            width: "320px",
            height: "320px",
            background:
              "radial-gradient(circle at 80% 35%, rgba(203, 213, 225, 0.30), transparent 55%)",
          },
        },
      ],
      fog: [
        {
          key: "fog-1",
          className: "absolute rounded-full blur-3xl opacity-55 floating-blob slow",
          style: {
            top: "-10%",
            left: "-8%",
            width: "420px",
            height: "420px",
            background:
              "radial-gradient(circle at 25% 25%, rgba(226, 232, 240, 0.40), transparent 55%)",
          },
        },
        {
          key: "fog-2",
          className: "absolute rounded-full blur-3xl opacity-40 floating-blob medium",
          style: {
            bottom: "-12%",
            right: "-10%",
            width: "320px",
            height: "320px",
            background:
              "radial-gradient(circle at 75% 30%, rgba(148, 163, 184, 0.24), transparent 55%)",
          },
        },
      ],
      default: [
        {
          key: "default-1",
          className: "absolute rounded-full blur-3xl opacity-55 floating-blob slow",
          style: {
            top: "-10%",
            left: "-8%",
            width: "420px",
            height: "420px",
            background:
              "radial-gradient(circle at 25% 25%, rgba(56, 189, 248, 0.35), transparent 55%)",
          },
        },
      ],
    };

    const blobs = blobSets[theme] || blobSets.default;
    return blobs.map((blob) => (
      <div key={blob.key} className={blob.className} style={blob.style} />
    ));
  }



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


  const textColorClass = textColors[theme] || "text-slate-900";

  return (

    <div
      className={`relative min-h-screen pt-20 flex flex-col items-center justify-between ${textColorClass} ${bg[theme]} p-6 overflow-hidden transition-colors duration-1000 ease-out`}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        {renderBackgroundBlobs(theme)}
      </div>

      <header className={`relative z-10 backdrop-blur-md bg-white/10 shadow-md justify-between ${textColorClass}`} >
        <div className="logo">
          <a
            href="/"
            className="
      flex items-center gap-2
      text-2xl sm:text-3xl font-extrabold
      tracking-tight
      select-none
      group 
      hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 ease-out
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
        <div className="flex gap-2 my-20 ">
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
            className="hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 ease-out border-2 border-blue-500 flex-1 text-current bg-white/15 px-4 py-2 rounded-lg outline-none"
          />
          <button
            onClick={() => getWeather()}
            className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg transition hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 ease-out"
          >
            {loading ? "..." : "Go"}
          </button>
        </div>

      </header>


      {/* MAIN */}
      <div className="relative z-10 flex-1 flex items-center flex-col justify-center w-full">

        <div className=" hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 ease-out w-full flex justify-center items-center max-w-md bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-2xl">


          {!weather && (
            <div className="text-center py-8">

              <div className="flex justify-center mb-6">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-32 h-32 text-current/80"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M3 15a4 4 0 014-4h1a5 5 0 019.9-1A3.5 3.5 0 0118.5 17H7a4 4 0 01-4-2z"
                  />
                </svg>
              </div>

              <h2 className="text-3xl font-semibold text-current">
                Discover Weather Anywhere
              </h2>

              <p className={`mt-3 ${subtleTextClass} max-w-sm mx-auto`}>
                Enter any city, town, or location above to view live weather,
                clothing recommendations, and a 7-day forecast.
              </p>

              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <span className="px-3 py-1 rounded-full bg-white/10 text-current text-sm">
                  🌍 Worldwide Search
                </span>

                <span className="px-3 py-1 rounded-full bg-white/10 text-current text-sm">
                  📅 7-Day Forecast
                </span>

                <span className="px-3 py-1 rounded-full bg-white/10 text-current text-sm">
                  👕 Outfit Suggestions
                </span>
              </div>

            </div>
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
              <p className="text-current/80">
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
                  <p className={`text-sm ${cardSubtleTextClass}`}>
                    Wind
                  </p>

                  <p className="text-3xl font-semibold mt-1">
                    {weather.wind}
                  </p>

                  <p className={`text-sm ${cardSubtleTextClass}`}>
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
                  <p className={`text-sm ${cardSubtleTextClass}`}>
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
                  <p className={`text-sm ${cardSubtleTextClass}`}>
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

            <div className="space-y-2 ">
              {weeklyWeather.time.map((day, i) => (
                <div
                  key={i}
                  className="flex justify-between bg-white/10 p-3 rounded-xl hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 ease-out"
                >
                  <span>{getWeekday(day)}</span>

                  <div className="text-right">
                    <div>
                      Max {Math.round(weeklyWeather.max[i])}° / Min {Math.round(weeklyWeather.min[i])}°
                    </div>

                    <div className={`text-xs ${cardSubtleTextClass}`}>
                      {conditions[weeklyWeather.code[i]] || "Unknown"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className=" hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 ease-out mt-8 w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-2xl">
          <h2 className="text-lg font-semibold mb-3">Pick a date</h2>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-current/80">
              Select a date from the calendar to view historical weather for the current location.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="date"
                id="=date"
                value={selectedDate}
                max={getTodayISO()}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border-2 border-blue-500 rounded-lg px-4 py-2 text-current bg-white/15"
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
                <p className="text-sm text-current/80">
                  Historical weather for {selectedDateWeather.date}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-2xl p-3">
                    <p className={`text-xs ${cardSubtleTextClass}`}>High</p>
                    <p className="text-2xl font-semibold">{Math.round(selectedDateWeather.max)}°</p>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-3">
                    <p className={`text-xs ${cardSubtleTextClass}`}>Low</p>
                    <p className="text-2xl font-semibold">{Math.round(selectedDateWeather.min)}°</p>
                  </div>
                </div>
                <p className={`mt-3 text-sm ${subtleTextClass}`}>
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
          <div className="bg-red-600/95 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-sm pointer-events-auto">
            <div className="flex-1 text-sm">{error}</div>
            <button
              onClick={() => {
                setToastVisible(false);
                setError("");
              }}
              aria-label="Dismiss"
              className="text-white/90 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {/* QUICK CITIES: clickable examples with typical climate notes */}
      <div className="w-full max-w-md mt-6">
        <h3 className="text-center text-sm text-current/80 mb-3">Don't have places in mind? Try these.</h3>

        <div className="flex flex-wrap justify-center gap-2 ">
          {quickCities.map((c) => (
            <div
              key={c.name}
              className="bg-white/10 border hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 ease-out border-white/20 px-3 py-2 rounded-lg text-sm flex items-center gap-3"
            >
              <div className="flex flex-col text-left">
                <button
                  onClick={() => getWeather(c.name)}
                  className="hover:underline text-current"
                >
                  {c.name}
                </button>
                <span className={`text-xs ${cardSubtleTextClass}`}>{c.note}</span>
              </div>

              <button
                onClick={() => copyCity(c.name)}
                className="text-xs bg-white/10 px-2 py-1 rounded text-current"
              >
                {copiedCity === c.name ? "Copied ✓" : "Copy"}
              </button>
            </div>
          ))}
        </div>
      </div>
      {locationAllowed !== true && (
        <div className="w-full max-w-md mt-8">
          <div
            className="
        bg-white/10
        backdrop-blur-xl
        border border-white/20
        rounded-3xl
        p-6
        shadow-2xl
        text-center
        hover:scale-[1.02]
        transition-all
        duration-300
      "
          >
            <div className="text-5xl mb-3">
              📍
            </div>

            <h2 className="text-2xl font-bold text-current">
              Enable Location Weather
            </h2>

            <p className={`mt-3 text-sm ${subtleTextClass}`}>
              Allow location access to instantly see weather for your current area
              without searching for a city.
            </p>

            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <span className="bg-white/10 px-3 py-1 rounded-full text-xs text-current">
                Local Forecast
              </span>

              <span className="bg-white/10 px-3 py-1 rounded-full text-xs text-current">
                Current Location Weather
              </span>

              <span className="bg-white/10 px-3 py-1 rounded-full text-xs text-current">
                Faster Results
              </span>
            </div>

            <button
              onClick={getUserLocation}
              className="
          mt-5
          w-full
          px-4
          py-3
          rounded-2xl
          bg-blue-500
          text-white
          font-semibold
          hover:bg-blue-600
          transition
        "
            >
              {locationAllowed === false
                ? "Retry Location Access"
                : "Use My Location"}
            </button>

            {locationAllowed === false && (
              <p className={`text-xs ${subtleTextClass} mt-3`}>
                Location permission is currently blocked. You can still use SkyCast
                by searching for any place manually.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}