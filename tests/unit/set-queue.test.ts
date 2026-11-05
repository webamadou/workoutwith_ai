// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref, type Ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import type { SetInput } from '@/services/workout'

let wrapper: VueWrapper
let queue: Ref<SetInput[]>
let saveSet: ReturnType<typeof vi.fn>
let record: (set: SetInput) => Promise<boolean>
let lastSyncError: { value: string }

const set = { workout_session_id: 'session', exercise_id: 'exercise', set_number: 1, reps: 9 } as SetInput

beforeEach(async () => {
  vi.resetModules()
  queue = ref<SetInput[]>([])
  saveSet = vi.fn()
  vi.doMock('@vueuse/core', () => ({ useStorage: () => queue }))
  vi.doMock('@/services/workout', () => ({ saveSet }))
  const queueModule = await import('@/composables/useSetQueue')
  lastSyncError = queueModule.lastSyncError
  wrapper = mount(defineComponent({
    setup() {
      record = queueModule.useSetQueue().record
      return () => h('div')
    },
  }))
})

afterEach(() => wrapper.unmount())

describe('synchronisation des séries', () => {
  it('retire la série après succès même si le stockage a recréé son objet', async () => {
    saveSet.mockImplementationOnce(async () => {
      queue.value = queue.value.map((item) => ({ ...item }))
    })
    expect(await record(set)).toBe(true)
    expect(queue.value).toEqual([])
  })

  it('conserve une série refusée et expose la cause', async () => {
    saveSet.mockRejectedValueOnce(new Error('contrainte de base de données'))
    expect(await record(set)).toBe(false)
    expect(queue.value).toHaveLength(1)
    expect(lastSyncError.value).toBe('contrainte de base de données')
  })

  it('envoie une correction saisie pendant la première synchronisation', async () => {
    saveSet.mockImplementationOnce(async () => {
      queue.value = [{ ...queue.value[0], reps: 12 }]
    })
    expect(await record(set)).toBe(true)
    expect(saveSet).toHaveBeenCalledTimes(2)
    expect(saveSet.mock.calls[1][0].reps).toBe(12)
  })
})
