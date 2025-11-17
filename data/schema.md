# Orchid Data Schema

Each orchid species is stored as a JSON file in `data/orchids/{slug}.json`

## Schema Structure

```json
{
  "name": "Common name of the orchid",
  "scientificName": "Scientific name (genus and species)",
  "slug": "url-friendly-slug",
  "description": "Brief description of the orchid",
  "care": {
    "light": "Light requirements and recommendations",
    "water": "Watering frequency and methods",
    "temperature": "Ideal temperature ranges",
    "humidity": "Humidity requirements",
    "fertilizer": "Fertilization schedule and type",
    "potting": "Potting medium and repotting guidance",
    "blooming": "Blooming season and tips"
  },
  "resources": {
    "videos": [
      {
        "url": "YouTube URL",
        "title": "Video title"
      }
    ],
    "websites": [
      {
        "url": "Website URL",
        "title": "Website or article title"
      }
    ]
  }
}
```

## Example

```json
{
  "name": "Moth Orchid",
  "scientificName": "Phalaenopsis",
  "slug": "phalaenopsis",
  "description": "One of the most popular orchids for beginners, known for its long-lasting flowers.",
  "care": {
    "light": "Bright, indirect light. East or west-facing windows are ideal.",
    "water": "Water weekly, allowing the potting medium to nearly dry between waterings.",
    "temperature": "65-80°F (18-27°C) during the day, slightly cooler at night.",
    "humidity": "50-70% humidity. Use a humidity tray if needed.",
    "fertilizer": "Feed weekly with a balanced orchid fertilizer diluted to half strength.",
    "potting": "Use orchid bark mix. Repot every 1-2 years after blooming.",
    "blooming": "Can bloom year-round with proper care. Flowers last 2-3 months."
  },
  "resources": {
    "videos": [
      {
        "url": "https://www.youtube.com/watch?v=example",
        "title": "Phalaenopsis Care Guide"
      }
    ],
    "websites": [
      {
        "url": "https://www.aos.org/orchids/orchid-care.aspx",
        "title": "American Orchid Society - Care Guide"
      }
    ]
  }
}
```
