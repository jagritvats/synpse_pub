"use client"
import { useState } from 'react'
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Card, CardContent } from "../../components/ui/card"
import { Sparkles, Brain, Clock, Cloud, Zap, MessageSquare, ChevronDown } from "lucide-react"
import Link from 'next/link'
import Image from 'next/image'

export default function LandingPage() {
  const [email, setEmail] = useState('')
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle email submission here
    console.log('Submitted email:', email)
    setEmail('')
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-amber-50 to-orange-100">
      <header className="px-4 lg:px-6 h-16 flex items-center sticky top-0 bg-white bg-opacity-80 backdrop-blur-md z-50">
        <Link className="flex items-center justify-center" href="#">
          <Sparkles className="h-8 w-8 mr-2 text-amber-500" />
          <span className="font-bold text-xl">Serendipity</span>
        </Link>
        <nav className="ml-auto hidden md:flex gap-4 sm:gap-6">
          <Link className="text-sm font-medium hover:text-amber-500 transition-colors" href="#features">
            Features
          </Link>
          <Link className="text-sm font-medium hover:text-amber-500 transition-colors" href="#ideas">
            Ideas
          </Link>
          <Link className="text-sm font-medium hover:text-amber-500 transition-colors" href="#cta">
            Get Started
          </Link>
        </nav>
        <Button
          className="ml-auto md:hidden"
          variant="ghost"
          size="icon"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
        </Button>
      </header>
      {isMenuOpen && (
        <nav className="flex flex-col items-center gap-4 py-4 bg-white md:hidden">
          <Link className="text-sm font-medium hover:text-amber-500 transition-colors" href="#features">
            Features
          </Link>
          <Link className="text-sm font-medium hover:text-amber-500 transition-colors" href="#ideas">
            Ideas
          </Link>
          <Link className="text-sm font-medium hover:text-amber-500 transition-colors" href="#cta">
            Get Started
          </Link>
        </nav>
      )}
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
                  Meet Your Digital <span className="text-amber-500">Companion</span>
                </h1>
                <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400">
                  Serendipity brings a touch of the unexpected to your digital life. It's not just an AI - it's a friend who's always up for an adventure.
                </p>
              </div>
              <div className="space-x-4">
                <Link
                  className="inline-flex h-9 items-center justify-center rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 disabled:pointer-events-none disabled:opacity-50"
                  href="/chat"
                >
                  Chat
                </Link>
                <Link
                  className="inline-flex h-9 items-center justify-center rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:pointer-events-none disabled:opacity-50"
                  href="/onboard"
                >
                  Join Us
                </Link>
                <Link
                  className="inline-flex h-9 items-center justify-center rounded-md border bg-amber-700  border-gray-200 bg-white px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:pointer-events-none disabled:opacity-50"
                  href="#features"
                >
                  Discover More
                </Link>
              </div>
            </div>
          </div>
        </section>
        <section id="features" className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-center mb-12">What Makes Us Different</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <FeatureCard
                icon={<Brain className="h-10 w-10 mb-4 text-amber-500" />}
                title="Contextual Understanding"
                description="We remember your tasks, goals, and preferences, making every interaction feel personal and relevant."
              />
              <FeatureCard
                icon={<Clock className="h-10 w-10 mb-4 text-green-500" />}
                title="Adaptive Memory"
                description="Short or long-term, we recall your experiences to provide timely and meaningful insights."
              />
              <FeatureCard
                icon={<Cloud className="h-10 w-10 mb-4 text-blue-500" />}
                title="Environmental Awareness"
                description="We consider factors like time and weather to offer practical, in-the-moment assistance."
              />
              <FeatureCard
                icon={<Zap className="h-10 w-10 mb-4 text-yellow-500" />}
                title="Curated Updates"
                description="Stay informed with personalized news and events that matter to you, minus the noise."
              />
              <FeatureCard
                icon={<MessageSquare className="h-10 w-10 mb-4 text-pink-500" />}
                title="Natural Conversations"
                description="Engage in genuine dialogues that go beyond simple queries and responses."
              />
              <FeatureCard
                icon={<Sparkles className="h-10 w-10 mb-4 text-indigo-500" />}
                title="Serendipitous Discoveries"
                description="Experience the joy of unexpected connections and insights in your daily routine."
              />
            </div>
          </div>
        </section>
        <section id="ideas" className="w-full py-12 md:py-24 lg:py-32 bg-white">
          <div className="container px-4 md:px-6">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-center mb-12">Expanding Possibilities</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold mb-2">Personalized Learning</h3>
                  <p>Discover new interests and deepen your knowledge with tailored learning paths that adapt to your pace and style.</p>
                </CardContent>
              </Card>
              <Card className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold mb-2">Emotional Intelligence</h3>
                  <p>Experience interactions that understand and respond to the nuances of human emotion, providing support when you need it most.</p>
                </CardContent>
              </Card>
              <Card className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold mb-2">Creative Catalyst</h3>
                  <p>Unlock your creative potential with AI-assisted brainstorming and idea generation tailored to your unique thought processes.</p>
                </CardContent>
              </Card>
              <Card className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold mb-2">Future Insights</h3>
                  <p>Explore potential outcomes and make informed decisions with our advanced predictive modeling capabilities.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
        <section id="cta" className="w-full py-12 md:py-24 lg:py-32 bg-amber-500 text-white">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">Ready to Explore?</h2>
                <p className="mx-auto max-w-[600px] text-amber-100 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  Join our community and be among the first to experience a new kind of digital companionship.
                </p>
              </div>
              <div className="w-full max-w-sm space-y-2">
                <form onSubmit={handleSubmit} className="flex space-x-2">
                  <Input
                    className="max-w-lg flex-1 bg-white text-amber-900 placeholder-amber-300"
                    placeholder="Your email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <Button type="submit" className="bg-white text-amber-500 hover:bg-amber-100">
                    Join Waitlist
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-gray-500">© 2023 Serendipity. All rights reserved.</p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link className="text-xs hover:underline underline-offset-4" href="#">
            Terms of Service
          </Link>
          <Link className="text-xs hover:underline underline-offset-4" href="#">
            Privacy Policy
          </Link>
        </nav>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }) {
  return (
    <Card className="group hover:shadow-lg transition-shadow">
      <CardContent className="flex flex-col items-center text-center p-6">
        <div className="mb-4 rounded-full bg-amber-100 p-2 group-hover:bg-amber-200 transition-colors">
          {icon}
        </div>
        <h3 className="text-lg font-bold mb-2">{title}</h3>
        <p className="text-sm text-gray-500">{description}</p>
      </CardContent>
    </Card>
  )
}