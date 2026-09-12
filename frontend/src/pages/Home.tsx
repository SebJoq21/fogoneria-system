import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import Portfolio from '../components/Portfolio'
import HowItWorks from '../components/HowItWorks'
import Testimonials from '../components/Testimonials'
import Pricing from '../components/Pricing'
import Footer from '../components/Footer'
import AuthModal from '../components/AuthModal'

function Home() {
  const [authModal, setAuthModal] = useState(null)
  const navigate = useNavigate()

  const handleSubmit = () => {
    if (authModal === 'register') {
      navigate('/onboarding')
    }
    setAuthModal(null)
  }

  return (
    <main className="min-h-screen w-[100vw] relative left-[50%] right-[50%] -ml-[50vw] -mr-[50vw] bg-[#0F172A]">
      <Navbar
        onLogin={() => setAuthModal('login')}
        onRegister={() => setAuthModal('register')}
      />
      <Hero />
      <Portfolio />
      <HowItWorks />
      <Testimonials />
      <Pricing onRegister={() => setAuthModal('register')} />
      <Footer />

      {authModal && (
        <AuthModal
          mode={authModal}
          onClose={() => setAuthModal(null)}
          onToggle={setAuthModal}
          onSubmit={handleSubmit}
        />
      )}
    </main>
  )
}

export default Home