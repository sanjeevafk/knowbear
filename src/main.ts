import './index.css'
import { subscribeRoute, navigate } from './router'
import { mountLandingPage } from './pages/LandingPage'
import { mountAppPage } from './pages/AppPage'

const root = document.getElementById('root')
if (!root) {
    throw new Error('Root element not found')
}

let unmountCurrent: (() => void) | null = null

function renderRoute(): void {
    const path = window.location.pathname
    unmountCurrent?.()
    unmountCurrent = null

    if (path === '/') {
        unmountCurrent = mountLandingPage(root!)
    } else if (path === '/app') {
        unmountCurrent = mountAppPage(root!)
    } else {
        navigate('/', { replace: true })
    }
}

subscribeRoute(renderRoute)
renderRoute()
