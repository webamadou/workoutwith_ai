import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { fetchExercises, toExerciseInfo } from '@/services/catalog'
import type { Exercise } from '@/services/types'

export const useCatalogStore = defineStore('catalog', () => {
  const exercises = ref<Exercise[]>([])
  let loading: Promise<void> | null = null

  const byId = computed(() => new Map(exercises.value.map((e) => [e.id, e])))
  const bySlug = computed(() => new Map(exercises.value.map((e) => [e.slug, e])))
  const infos = computed(() => exercises.value.map(toExerciseInfo))

  function load(force = false) {
    if (force || !loading) loading = fetchExercises().then((e) => { exercises.value = e }).catch((e) => { loading = null; throw e })
    return loading
  }

  return { exercises, byId, bySlug, infos, load }
})
