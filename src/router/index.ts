import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
  routes: [
    { path: '/connexion', name: 'login', component: () => import('@/pages/LoginPage.vue'), meta: { public: true, bare: true } },
    { path: '/bienvenue', name: 'onboarding', component: () => import('@/pages/OnboardingPage.vue'), meta: { bare: true } },
    { path: '/', name: 'dashboard', component: () => import('@/pages/DashboardPage.vue') },
    { path: '/programme', name: 'program', component: () => import('@/pages/ProgramPage.vue') },
    { path: '/exercices', name: 'exercises', component: () => import('@/pages/ExerciseLibraryPage.vue') },
    { path: '/exercices/:slug', name: 'exercise', component: () => import('@/pages/ExercisePage.vue') },
    { path: '/seance', name: 'workout-start', component: () => import('@/pages/WorkoutStartPage.vue') },
    { path: '/seance/:id', name: 'workout', component: () => import('@/pages/WorkoutPage.vue'), meta: { bare: true } },
    { path: '/seance/:id/bilan', name: 'summary', component: () => import('@/pages/SessionSummaryPage.vue') },
    { path: '/progression', name: 'progress', component: () => import('@/pages/ProgressPage.vue') },
    { path: '/coach', name: 'coach', component: () => import('@/pages/CoachPage.vue') },
    { path: '/profil', name: 'profile', component: () => import('@/pages/ProfilePage.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.init()
  if (to.meta.public) return auth.user ? { name: 'dashboard' } : true
  if (!auth.user) return { name: 'login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : undefined }
  if (!auth.onboarded && to.name !== 'onboarding') return { name: 'onboarding' }
  return true
})

export default router
