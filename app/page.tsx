import Link from 'next/link'
import { promises as fs } from 'fs'
import path from 'path'

interface OrchidData {
  name: string
  scientificName: string
  slug: string
  care?: {
    light?: string
    water?: string
    temperature?: string
    humidity?: string
    fertilizer?: string
  }
  resources?: {
    websites?: Array<{ url: string; title: string }>
    videos?: Array<{ url: string; title: string }>
  }
}

async function getOrchids(): Promise<OrchidData[]> {
  try {
    const dataDir = path.join(process.cwd(), 'data', 'orchids')
    const files = await fs.readdir(dataDir)
    const jsonFiles = files.filter(file => file.endsWith('.json'))

    const orchids = await Promise.all(
      jsonFiles.map(async (file) => {
        const content = await fs.readFile(path.join(dataDir, file), 'utf-8')
        return JSON.parse(content) as OrchidData
      })
    )

    return orchids.sort((a, b) => a.name.localeCompare(b.name))
  } catch (error) {
    // Return empty array if no data exists yet
    return []
  }
}

export default async function Home() {
  const orchids = await getOrchids()

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Welcome to Orchid Care Guide</h2>
        <p className="text-lg text-gray-600">
          Discover comprehensive care information for various orchid species. Browse our collection below.
        </p>
      </div>

      {orchids.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">No orchid data yet</h3>
          <p className="text-yellow-700">
            Run the content generation script to create orchid care guides:
          </p>
          <code className="block mt-2 bg-yellow-100 p-2 rounded">
            npm run generate-content
          </code>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {orchids.map((orchid) => (
            <Link
              key={orchid.slug}
              href={`/orchid/${orchid.slug}`}
              className="block bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow p-6"
            >
              <h3 className="text-xl font-semibold text-purple-600 mb-2">
                {orchid.name}
              </h3>
              <p className="text-sm text-gray-500 italic mb-4">
                {orchid.scientificName}
              </p>
              {orchid.care && (
                <div className="text-sm text-gray-600">
                  <p className="line-clamp-2">
                    {orchid.care.light && `Light: ${orchid.care.light}`}
                  </p>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
