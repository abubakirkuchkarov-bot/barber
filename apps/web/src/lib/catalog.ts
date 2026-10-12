export type Service = {
  id: string;
  name: string;
  description: string;
  durationMin: number;
  price: number;
};

export type Barber = {
  id: string;
  name: string;
  bio: string | null;
  experienceYears: number;
  photoUrl: string | null;
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${path} ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function getServices() {
  const body = await getJson<{ services: Service[] }>("/api/v1/services");
  return body.services;
}

export async function getBarbers() {
  const body = await getJson<{ barbers: Barber[] }>("/api/v1/barbers");
  return body.barbers;
}
