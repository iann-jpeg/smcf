import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import TrafficDashboard from '@/components/admin/TrafficDashboard';
import { ThemeToggle } from '@/components/theme-toggle';

interface AdminAnalyticsProps {
  onBack?: () => void;
}

export default function AdminAnalytics({ onBack }: AdminAnalyticsProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {onBack && (
                <Button variant="ghost" size="icon" onClick={onBack}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              )}
              <div>
                <h1 className="text-2xl font-bold">Admin Analytics & Traffic</h1>
                <p className="text-sm text-muted-foreground">
                  Comprehensive system monitoring and audit dashboard
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="py-6">
        <TrafficDashboard />
      </div>
    </div>
  );
}
