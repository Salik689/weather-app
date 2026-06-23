export async function GET(req) {

  const forwarded = req.headers.get("x-forwarded-for");

  const ip =
    forwarded?.split(",")[0].trim()
    || req.headers.get("x-real-ip")
    || "";

  try {

    const res = await fetch(
      `http://ip-api.com/json/${ip}`
    );

    const data = await res.json();

    return Response.json({

      ip,

      city: data.city,

      country: data.country,

      region: data.regionName,

      latitude: data.lat,

      longitude: data.lon,

    });

  }

  catch(err) {

    return Response.json(

      {

        error: "Failed to get location"

      },

      {

        status: 500

      }

    );

  }

}