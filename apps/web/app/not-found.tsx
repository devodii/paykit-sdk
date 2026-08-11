import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle, Home, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <Card.Root className="w-full max-w-md text-center">
        <Card.Header className="space-y-4">
          <div className="bg-muted mx-auto flex h-16 w-16 items-center justify-center rounded-full">
            <AlertCircle className="text-muted-foreground h-8 w-8" />
          </div>
          <div className="space-y-2">
            <Card.Title className="text-4xl font-bold">
              404
            </Card.Title>
            <Card.Description className="text-lg">
              Page not found
            </Card.Description>
          </div>
        </Card.Header>
        <Card.Content className="space-y-4">
          <p className="text-muted-foreground">
            Sorry, we couldn&apos;t find the page you&apos;re looking
            for.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild variant="outline">
              <Link href="/" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Go back
              </Link>
            </Button>
            <Button asChild>
              <Link href="/" className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                Home
              </Link>
            </Button>
          </div>
        </Card.Content>
      </Card.Root>
    </div>
  );
}
