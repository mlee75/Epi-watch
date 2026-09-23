/**
 * Public traffic cameras, for a live view near a selected incident.
 *
 *  - Transport for London JamCams: ~900 cameras, each with a still image and a
 *    short video clip refreshed every few minutes.
 *  - Seattle Department of Transportation: still images refreshed every
 *    minute or two.
 *
 * These show the street near an incident, not the incident itself, and the
 * interface says so. There are no public live video feeds of emergency
 * operations.
 */

export const CAMERAS_REVALIDATE = 3600;

export interface Camera {
  id: string;
  name: string;
  lat: number;
  lon: number;
  imageUrl: string;
  videoUrl: string | null;
  source: 'TfL' | 'SDOT';
}

async function fetchTfl(): Promise<Camera[]> {
  const res = await fetch('https://api.tfl.gov.uk/Place/Type/JamCam', {
    next: { revalidate: CAMERAS_REVALIDATE },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(String(res.status));
  const list = (await res.json()) as Array<{
    id: string; commonName: string; lat: number; lon: number;
    additionalProperties: Array<{ key: string; value: string }>;
  }>;
  return list.flatMap((c) => {
    const prop = (k: string) => c.additionalProperties.find((p) => p.key === k)?.value;
    const img = prop('imageUrl');
    if (!img || prop('available') === 'false') return [];
    return [{ id: c.id, name: c.commonName, lat: c.lat, lon: c.lon, imageUrl: img, videoUrl: prop('videoUrl') ?? null, source: 'TfL' as const }];
  });
}

async function fetchSdot(): Promise<Camera[]> {
  const res = await fetch('https://web.seattle.gov/Travelers/api/Map/Data?zoomId=13&type=2', {
    next: { revalidate: CAMERAS_REVALIDATE },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(String(res.status));
  const json = (await res.json()) as {
    Features: Array<{ PointCoordinate: [number, number]; Cameras: Array<{ Id: string; Description: string; ImageUrl: string; Type: string }> }>;
  };
  return json.Features.flatMap((f) =>
    f.Cameras.filter((c) => c.Type === 'sdot').map((c) => ({
      id: `sdot-${c.Id}`,
      name: c.Description,
      lat: f.PointCoordinate[0],
      lon: f.PointCoordinate[1],
      imageUrl: `https://www.seattle.gov/trafficcams/images/${c.ImageUrl}`,
      videoUrl: null,
      source: 'SDOT' as const,
    }))
  );
}

export async function fetchCameras(): Promise<{ cameras: Camera[]; ok: boolean }> {
  const [tfl, sdot] = await Promise.allSettled([fetchTfl(), fetchSdot()]);
  const cameras = [
    ...(tfl.status === 'fulfilled' ? tfl.value : []),
    ...(sdot.status === 'fulfilled' ? sdot.value : []),
  ];
  return { cameras, ok: tfl.status === 'fulfilled' || sdot.status === 'fulfilled' };
}
