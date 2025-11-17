# Orchid Care Guide

A comprehensive web application for exploring care guides for different orchid species. The app uses Next.js for the frontend, and LangChain with Ollama and Qdrant for AI-powered RAG (Retrieval-Augmented Generation) content generation.

## Features

- 🌸 Beautiful, responsive web interface built with Next.js and Tailwind CSS
- 🤖 AI-generated care guides using RAG (Retrieval-Augmented Generation)
- 📚 Evidence-based content from YouTube videos and websites
- 🔍 Vector search with Qdrant for accurate information retrieval
- 🎥 Curated YouTube videos and website resources (prioritized)
- 🚀 Static site generation for fast loading
- ☁️ Ready for deployment on Netlify

## Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  orchids-list.md│─────▶│ fetch-resources  │─────▶│ data/resources/ │
│  (source list)  │      │     (script)     │      │  (JSON files)   │
└─────────────────┘      └──────────────────┘      └─────────────────┘
                                                             │
                                                             ▼
                         ┌──────────────────┐      ┌─────────────────┐
                         │ ingest-to-qdrant │◀─────│   Chunk & Embed │
                         │     (script)     │      │                 │
                         └──────────────────┘      └─────────────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │  Qdrant Vector  │
                         │    Database     │
                         └─────────────────┘
                                  │
                                  ▼
                         ┌──────────────────┐      ┌─────────────────┐
                         │ generate-content │─────▶│ data/orchids/   │
                         │  (RAG script)    │      │  (JSON files)   │
                         └──────────────────┘      └─────────────────┘
                                                             │
                                                             ▼
                                                    ┌─────────────────┐
                                                    │   Next.js App   │
                                                    │   (Website)     │
                                                    └─────────────────┘
```

## Project Structure

```
orchids/
├── app/                          # Next.js app directory
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Home page (orchid list)
│   ├── orchid/[slug]/page.tsx  # Individual orchid detail page
│   └── globals.css              # Global styles
├── data/
│   ├── orchids-list.md         # Source list of orchids (EDIT THIS)
│   ├── resources/              # Fetched resources (generated)
│   ├── orchids/                # Final care guides (generated)
│   └── schema.md               # Data schema documentation
├── scripts/
│   ├── fetch-resources.js      # Fetch YouTube & websites
│   ├── ingest-to-qdrant.js    # Ingest to vector DB
│   └── generate-content.js     # Generate care guides with RAG
├── docker-compose.yml          # Qdrant setup
├── package.json                # Dependencies and scripts
├── netlify.toml               # Netlify configuration
└── README.md                   # This file
```

## Prerequisites

1. **Node.js** (v18 or higher)
2. **Docker & Docker Compose** (for Qdrant)
3. **Ollama** running locally
   - Install: https://ollama.ai/
   - Start the service: `ollama serve`
   - Pull required models:
     - `ollama pull llama3.2` (for content generation)
     - `ollama pull nomic-embed-text` (for embeddings)

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Qdrant Vector Database

```bash
docker-compose up -d
```

This will start Qdrant on `http://localhost:6333`. You can access the dashboard at `http://localhost:6333/dashboard`.

### 3. Configure Environment Variables (Optional)

Copy `.env.example` to `.env` and modify if needed:

```bash
cp .env.example .env
```

Default values:
- `OLLAMA_MODEL=llama3.2`
- `OLLAMA_BASE_URL=http://localhost:11434`
- `QDRANT_URL=http://localhost:6333`
- `EMBEDDING_MODEL=nomic-embed-text`

### 4. Configure Orchid Species

Edit `data/orchids-list.md` to add or modify orchid species. **You can add custom YouTube videos and websites that will be prioritized:**

```markdown
### Moth Orchid (*Phalaenopsis*)
- Videos: https://www.youtube.com/watch?v=your-video-id
- Websites: https://example.com/phalaenopsis-care, https://aos.org/phalaenopsis

Popular beginner orchid with long-lasting flowers.
```

### 5. Run the Complete Pipeline

Option A: Run all steps automatically:

```bash
npm run full-pipeline
```

Option B: Run steps individually:

```bash
# Step 1: Fetch resources from YouTube and websites
npm run fetch-resources

# Step 2: Ingest resources into Qdrant vector database
npm run ingest-to-qdrant

# Step 3: Generate care guides using RAG
npm run generate-content
```

### 6. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 7. Build for Production

```bash
npm run build
```

The static site will be generated in the `out/` directory.

## Detailed Workflow

### Step 1: Fetch Resources

The `fetch-resources` script:
- Reads orchid species from `data/orchids-list.md`
- Fetches YouTube video transcripts using the YouTube Transcript API
- Scrapes website content using Cheerio
- Prioritizes user-provided custom resources
- Saves fetched content to `data/resources/`

**Custom Resources:**
Add your own curated URLs to `data/orchids-list.md`:

```markdown
### Your Orchid (*Scientific Name*)
- Videos: https://youtube.com/watch?v=video1, https://youtube.com/watch?v=video2
- Websites: https://example.com/care-guide, https://orchids.org/your-orchid

Brief description of the orchid.
```

### Step 2: Ingest to Qdrant

The `ingest-to-qdrant` script:
- Reads fetched resources from `data/resources/`
- Chunks content into manageable pieces (1000 chars with 200 char overlap)
- Generates embeddings using Ollama's `nomic-embed-text` model
- Stores vectors and metadata in Qdrant
- Enables semantic search for care information

**Browse your data:**
Visit the Qdrant dashboard at `http://localhost:6333/dashboard` to explore the vector database.

### Step 3: Generate Content with RAG

The `generate-content` script:
- Reads orchid species from `data/orchids-list.md`
- For each care aspect (light, water, temperature, etc.):
  - Queries Qdrant for relevant information
  - Retrieves top matching content chunks
- Uses Ollama LLM with retrieved context to generate care guides
- Only uses information from the retrieved sources (evidence-based)
- Saves comprehensive care guides to `data/orchids/`

### Step 4: Display on Website

The Next.js app:
- Reads JSON files from `data/orchids/`
- Displays orchid list on home page
- Shows detailed care guides on individual pages
- Provides links to original YouTube videos and websites

## Deployment to Netlify

### Important: Generate Content First

Before deploying, you must run the content generation pipeline locally and commit the generated files:

```bash
# Run the full pipeline
npm run full-pipeline

# Add generated files to git
git add data/orchids/*.json

# Commit
git commit -m "Add generated orchid care guides"

# Push to your repository
git push
```

### Deploy via Netlify

**Option 1: Netlify CLI**

```bash
npm install -g netlify-cli
netlify login
netlify init
netlify deploy --prod
```

**Option 2: Git Integration**

1. Push your repository to GitHub
2. Connect your repository in Netlify dashboard
3. Netlify will automatically build and deploy

The `netlify.toml` file is already configured for static export.

## Environment Variables

Customize the content generation process:

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_MODEL` | `llama3.2` | Ollama model for content generation |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API URL |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant vector database URL |
| `QDRANT_COLLECTION` | `orchid_care_resources` | Collection name in Qdrant |
| `EMBEDDING_MODEL` | `nomic-embed-text` | Embedding model for vector search |
| `CHUNK_SIZE` | `1000` | Text chunk size for embeddings |
| `CHUNK_OVERLAP` | `200` | Overlap between chunks |
| `MAX_RESOURCES_PER_ORCHID` | `5` | Max resources to fetch per orchid |

Example:

```bash
OLLAMA_MODEL=llama3.1 EMBEDDING_MODEL=mxbai-embed-large npm run full-pipeline
```

## Data Schema

Each orchid species is stored as a JSON file with the following structure:

```json
{
  "name": "Common Name",
  "scientificName": "Scientific Name",
  "slug": "url-slug",
  "description": "Brief description",
  "care": {
    "light": "Light requirements (generated from sources)",
    "water": "Watering instructions (generated from sources)",
    "temperature": "Temperature range (generated from sources)",
    "humidity": "Humidity requirements (generated from sources)",
    "fertilizer": "Fertilization schedule (generated from sources)",
    "potting": "Potting guidance (generated from sources)",
    "blooming": "Blooming information (generated from sources)"
  },
  "resources": {
    "videos": [{"url": "...", "title": "..."}],
    "websites": [{"url": "...", "title": "..."}]
  },
  "generatedAt": "ISO timestamp",
  "generatedWith": "RAG (Qdrant + Ollama)"
}
```

See `data/schema.md` for more details.

## Troubleshooting

### Ollama Connection Issues

If scripts can't connect to Ollama:

1. Make sure Ollama is running: `ollama serve`
2. Check if you have models installed: `ollama list`
3. Pull required models:
   ```bash
   ollama pull llama3.2
   ollama pull nomic-embed-text
   ```
4. Verify the base URL: `echo $OLLAMA_BASE_URL`

### Qdrant Connection Issues

If scripts can't connect to Qdrant:

1. Make sure Qdrant is running: `docker-compose ps`
2. Start Qdrant if needed: `docker-compose up -d`
3. Check logs: `docker-compose logs qdrant`
4. Access dashboard: `http://localhost:6333/dashboard`

### No Resources Fetched

If no resources are fetched for orchids:

1. Add custom YouTube and website URLs to `data/orchids-list.md`
2. Check that URLs are properly formatted
3. Some videos may not have transcripts available
4. Some websites may block scraping (use reputable orchid sites)

### No Orchid Data Shown on Website

If the website shows "No orchid data yet":

1. Run the full pipeline: `npm run full-pipeline`
2. Check that JSON files were created in `data/orchids/`
3. Rebuild the Next.js app: `npm run build`

### Build Errors

Make sure all dependencies are installed:

```bash
rm -rf node_modules package-lock.json
npm install
```

## Recommended Resources

Good websites for orchid care information:
- American Orchid Society: https://www.aos.org/
- RepotMe: https://www.repotme.com/orchid-care
- Orchid Bliss: https://orchidbliss.com/
- OrchidWeb: https://www.orchidweb.com/

## Future Enhancements

- [ ] Automatic web scraping with configurable sources
- [ ] Search functionality within the app
- [ ] Filtering by care difficulty level
- [ ] Image galleries for each orchid species
- [ ] User comments and tips section
- [ ] Mobile app version
- [ ] Database integration for dynamic content
- [ ] Real-time updates without rebuilding

## Technology Stack

- **Frontend:** Next.js 15, React 19, Tailwind CSS
- **Vector Database:** Qdrant
- **AI/ML:** LangChain, Ollama (llama3.2, nomic-embed-text)
- **Content Fetching:** YouTube Transcript API, Cheerio
- **Deployment:** Netlify (static export)

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT
