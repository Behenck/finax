import { HeadContent, Outlet, createRootRoute } from '@tanstack/react-router'
import React from 'react'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <React.Fragment>
      <HeadContent />
      <Outlet />
    </React.Fragment>
  )
}