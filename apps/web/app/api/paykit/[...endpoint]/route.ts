import { endpoints } from '@/lib/paykit';
import type {
  EndpointArgs,
  EndpointHandler,
  EndpointPath,
} from '@paykit-sdk/core';
import { NextResponse, NextRequest } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ endpoint: string[] }> },
) {
  const { endpoint: endpointArray } = await params;

  const endpoint = ('/' + endpointArray.join('/')) as EndpointPath;

  const handler = endpoints[endpoint] as EndpointHandler<
    typeof endpoint
  >;

  if (!handler) {
    return NextResponse.json(
      { message: 'Endpoint not found' },
      { status: 404 },
    );
  }

  const body = await request.json();

  const { args } = body as { args: EndpointArgs<typeof endpoint> };

  try {
    const result = await handler(...args);
    return NextResponse.json({ result });
  } catch (error) {
    console.error('PayKit API Error:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Internal server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
