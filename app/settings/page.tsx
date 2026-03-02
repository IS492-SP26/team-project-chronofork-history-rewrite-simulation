import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Monitor, Volume2, Eye, Palette } from "lucide-react"

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-cover bg-center opacity-10" style={{ backgroundImage: "url('/images/war-room-bg.jpg')" }} />
        <div className="absolute inset-0 bg-background/95" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
              Back to Console
            </Button>
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>

        <div className="flex flex-col gap-6">
          <Card className="bg-card/50 border-border/30 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2 text-foreground">
                <Monitor className="w-4 h-4" />
                Display
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Theme</span>
                <Badge variant="outline" className="text-[10px] font-mono border-border/50 text-muted-foreground">
                  Light (War Room)
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Reduced Motion</span>
                <Badge variant="outline" className="text-[10px] font-mono border-border/50 text-muted-foreground">
                  System Default
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/30 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2 text-foreground">
                <Volume2 className="w-4 h-4" />
                Audio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Sound Effects</span>
                <Badge variant="outline" className="text-[10px] font-mono border-border/50 text-muted-foreground">
                  Coming Soon
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/30 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2 text-foreground">
                <Eye className="w-4 h-4" />
                Connection
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Backend URL</span>
                <span className="text-[10px] font-mono text-muted-foreground/60">Not configured</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">WebSocket Status</span>
                <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground border-border/50">
                  Disconnected (Mock Mode)
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
