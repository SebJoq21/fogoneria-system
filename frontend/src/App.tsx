import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Onboarding from './pages/Onboarding'
import Terminos from './pages/Terminos'
import ClientDashboard from './pages/ClientDashboard'
import DemoPage from './pages/DemoPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/terminos" element={<Terminos />} />
        <Route path="/dashboard" element={<ClientDashboard />} />
        <Route path="/demo/:id" element={<DemoPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App