// Тестовые хелперы shared (в прод-дверь слоя НЕ входят — см. shared/index.ts:
// реэкспорт lib создал бы цикл и тянул тест-код в @/shared). Потребители —
// только *.test.ts (import из '@/shared/lib').
export { pumpUntilSettled } from './testPump'
