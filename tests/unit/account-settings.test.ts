import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({ supabase: { auth: { updateUser: vi.fn() } } }))
vi.mock('@/services/profile', () => ({ fetchProfile: vi.fn(), updateProfile: vi.fn() }))

const updateUser = vi.mocked(supabase.auth.updateUser)

beforeEach(() => {
  setActivePinia(createPinia())
  updateUser.mockReset()
  vi.stubGlobal('window', { location: { origin: 'https://theaicoach.netlify.app' } })
})

describe('réglages du compte', () => {
  it('demande une confirmation lorsque la nouvelle adresse reste en attente', async () => {
    updateUser.mockResolvedValueOnce({ data: { user: { email: 'ancien@example.com' } }, error: null } as never)
    expect(await useAuthStore().changeEmail('nouveau@example.com')).toBe(false)
    expect(updateUser).toHaveBeenCalledWith({ email: 'nouveau@example.com' }, { emailRedirectTo: 'https://theaicoach.netlify.app' })
  })

  it('signale une mise à jour immédiate et propage les erreurs de mot de passe', async () => {
    updateUser.mockResolvedValueOnce({ data: { user: { email: 'nouveau@example.com' } }, error: null } as never)
    expect(await useAuthStore().changeEmail('nouveau@example.com')).toBe(true)

    const error = new Error('Mot de passe refusé')
    updateUser.mockResolvedValueOnce({ data: { user: null }, error } as never)
    await expect(useAuthStore().changePassword('nouveau-secret')).rejects.toBe(error)
    expect(updateUser).toHaveBeenLastCalledWith({ password: 'nouveau-secret' })
  })
})
