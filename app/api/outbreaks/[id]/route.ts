import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const outbreak = await prisma.outbreak.findUnique({
      where: { id: params.id },
    });

    if (!outbreak) {
      return NextResponse.json({ error: 'Outbreak not found' }, { status: 404 });
    }

    return NextResponse.json({ data: outbreak });
  } catch (err) {
    console.error('[GET /api/outbreaks/:id]', err);
    return NextResponse.json({ error: 'Failed to fetch outbreak' }, { status: 500 });
  }
}
