import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setTimeout(() => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT), 0)
    }
    mql.addEventListener("change", onChange)
    
    // Defer the initial state setting to avoid React warning
    const timer = setTimeout(() => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }, 0)
    
    return () => {
      mql.removeEventListener("change", onChange)
      clearTimeout(timer)
    }
  }, [])

  return !!isMobile
}
