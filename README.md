# Orchid Care Guide

A comprehensive web application for exploring care guides for different orchid species. The app uses Next.js for the frontend and LangChain with Ollama for AI-powered content generation.

## Features

- 🌸 Beautiful, responsive web interface built with Next.js and Tailwind CSS
- 🤖 AI-generated care guides using LangChain and Ollama
- 📚 Detailed care information for each orchid species
- 🎥 Curated YouTube videos and website resources
- 🔍 Custom resource prioritization
- 🚀 Static site generation for fast loading
- ☁️ Ready for deployment on Netlify

## Project Structure

```
orchids/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page (orchid list)
│   ├── orchid/
│   │   └── [slug]/
│   │       └── page.tsx   # Individual orchid detail page
│   └── globals.css        # Global styles
├── data/
│   ├── orchids-list.md    # Source list of orchids to generate
│   ├── orchids/           # Generated JSON files (one per species)
│   └── schema.md          # Data schema documentation
├── scripts/
│   └── generate-content.js # Content generation script
├── public/                # Static assets
├── package.json           # Dependencies and scripts
├── netlify.toml          # Netlify configuration
└── README.md             # This file
```

## Prerequisites

1. **Node.js** (v18 or higher)
2. **Ollama** running locally
   - Install: https://ollama.ai/
   - Start the service: `ollama serve`
   - Pull a model: `ollama pull llama3.2`

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Orchid Species

Edit `data/orchids-list.md` to add or modify orchid species. You can also add custom YouTube videos and websites that will be prioritized in the output:

```markdown
### Moth Orchid (*Phalaenopsis*)
- Videos: https://www.youtube.com/watch?v=your-video-id
- Websites: https://example.com/phalaenopsis-care

Popular beginner orchid with long-lasting flowers.
```

### 3. Generate Content

Make sure Ollama is running, then generate the care guides:

```bash
npm run generate-content
```

This script will:
- Read the orchid species from `data/orchids-list.md`
- Use Ollama to generate detailed care information for each species
- Include any custom resources you've specified
- Save JSON files to `data/orchids/`

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Build for Production

```bash
npm run build
```

The static site will be generated in the `out/` directory.

## Environment Variables

You can customize the content generation by setting these environment variables:

- `OLLAMA_MODEL` - The Ollama model to use (default: `llama3.2`)
- `OLLAMA_BASE_URL` - Ollama API URL (default: `http://localhost:11434`)

Example:

```bash
OLLAMA_MODEL=llama3.1 npm run generate-content
```

## Deployment to Netlify

### Option 1: Netlify CLI

```bash
npm install -g netlify-cli
netlify login
netlify init
netlify deploy --prod
```

### Option 2: Git Integration

1. Push your repository to GitHub
2. Connect your repository in Netlify dashboard
3. Netlify will automatically build and deploy

**Important**: Before deploying, make sure to run `npm run generate-content` locally to create the orchid data files. The generated JSON files should be committed to your repository.

### Netlify Configuration

The `netlify.toml` file is already configured:

```toml
[build]
  command = "npm run build"
  publish = "out"
```

## Adding Custom Resources

To add your own curated resources for any orchid:

1. Edit `data/orchids-list.md`
2. Add custom videos and websites under the orchid species:

```markdown
### Your Orchid (*Scientific Name*)
- Videos: https://youtube.com/watch?v=video1, https://youtube.com/watch?v=video2
- Websites: https://example.com/care-guide, https://orchids.org/your-orchid
```

3. Re-run the content generation script
4. Your custom resources will appear first in the resource list

## Data Schema

Each orchid species is stored as a JSON file with the following structure:

```json
{
  "name": "Common Name",
  "scientificName": "Scientific Name",
  "slug": "url-slug",
  "description": "Brief description",
  "care": {
    "light": "Light requirements",
    "water": "Watering instructions",
    "temperature": "Temperature range",
    "humidity": "Humidity requirements",
    "fertilizer": "Fertilization schedule",
    "potting": "Potting guidance",
    "blooming": "Blooming information"
  },
  "resources": {
    "videos": [{"url": "...", "title": "..."}],
    "websites": [{"url": "...", "title": "..."}]
  }
}
```

See `data/schema.md` for more details.

## Troubleshooting

### Ollama Connection Issues

If the content generator can't connect to Ollama:

1. Make sure Ollama is running: `ollama serve`
2. Check if you have a model installed: `ollama list`
3. Pull a model if needed: `ollama pull llama3.2`
4. Verify the base URL: `echo $OLLAMA_BASE_URL`

### No Orchid Data Shown

If the website shows "No orchid data yet":

1. Run the content generation script: `npm run generate-content`
2. Check that JSON files were created in `data/orchids/`
3. Rebuild the Next.js app: `npm run build`

### Build Errors

Make sure all dependencies are installed:

```bash
rm -rf node_modules package-lock.json
npm install
```

## Future Enhancements

- [ ] Web scraping to automatically find YouTube videos and websites
- [ ] Database integration (Netlify supports PostgreSQL)
- [ ] Search functionality
- [ ] Filtering by care difficulty
- [ ] Image galleries for each orchid species
- [ ] User comments and care tips
- [ ] Mobile app version

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT
