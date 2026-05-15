import { Button } from '@paykit-sdk/ui';
import { BookOpen } from 'lucide-react';
import Link from 'next/link';

export const FinalCTA = () => {
  return (
    <section className="relative py-20">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5"></div>
      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <div className="space-y-8">
          <div className="space-y-4">
            <h2 className="text-4xl font-bold tracking-tight md:text-5xl">
              Ready to build
              <br />
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                payment-agnostic apps?
              </span>
            </h2>
            <p className="text-muted-foreground mx-auto max-w-2xl text-xl">
              Start with local development today. Deploy to any
              provider tomorrow.
            </p>
          </div>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button asChild variant="outline" size="lg">
              <Link href="https://docs.usepaykit.dev/introduction">
                <BookOpen className="mr-2 h-5 w-5" />
                Read Documentation
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};
