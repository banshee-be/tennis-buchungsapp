import { NextResponse } from "next/server";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function handleRoute<T>(handler: () => Promise<T>) {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error(error);
    return jsonError("Es ist ein unerwarteter Fehler aufgetreten.", 500);
  }
}
