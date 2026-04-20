import roadmapRaw from '../../docs/ROADMAP_PAC.md?raw'
import { parseRoadmap, globalStats } from './roadmapParser'

export const roadmapSource = roadmapRaw
export const roadmapParsed = parseRoadmap(roadmapRaw)
export const roadmapStats = globalStats(roadmapParsed)
