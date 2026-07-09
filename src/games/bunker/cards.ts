import type { BunkerCard, BunkerCardCategory, BunkerSpecialCard } from "./types";

function card(category: BunkerCardCategory, id: string, title: string, description?: string, tags: string[] = []): BunkerCard {
  return { id: `${category}_${id}`, category, title, description, tags };
}

export const bunkerCards: Record<Exclude<BunkerCardCategory, "special">, BunkerCard[]> = {
  profession: [
    card("profession", "doctor", "Врач скорой помощи", "Оказывает первую помощь и быстро решает медицинские кризисы.", ["medicine"]),
    card("profession", "engineer", "Инженер-механик", "Ремонтирует генераторы, насосы и простые механизмы.", ["repair", "energy"]),
    card("profession", "farmer", "Фермер", "Выращивает пищу и понимает уход за животными.", ["food", "plants"]),
    card("profession", "teacher", "Учитель", "Систематизирует знания и обучает группу.", ["education"]),
    card("profession", "chemist", "Химик-технолог", "Работает с фильтрами, реактивами и очисткой воды.", ["science"]),
    card("profession", "cook", "Повар", "Экономно распределяет продукты и готовит из малого набора.", ["food"]),
    card("profession", "paramedic", "Фельдшер", "Стабилизирует пациентов в полевых условиях.", ["medicine"]),
    card("profession", "builder", "Строитель", "Укрепляет помещения и чинит конструкции.", ["repair"]),
    card("profession", "psychologist", "Психолог", "Снижает конфликты и помогает пережить стресс.", ["team"]),
    card("profession", "radio", "Радиолюбитель", "Может собрать связь из старых деталей.", ["communication"]),
    card("profession", "biologist", "Биолог", "Понимает растения, микроорганизмы и риски заражения.", ["biology"]),
    card("profession", "driver", "Водитель-экспедитор", "Знает маршруты, ремонтирует транспорт и работает с логистикой.", ["logistics"])
  ],
  age: ["19 лет", "24 года", "28 лет", "31 год", "36 лет", "42 года", "47 лет", "53 года", "60 лет", "67 лет", "22 года", "39 лет"].map((title, index) => card("age", String(index + 1), title)),
  gender: ["Женщина", "Мужчина", "Небинарный человек"].map((title, index) => card("gender", String(index + 1), title)),
  health: [
    card("health", "healthy", "Здоров", "Нет серьезных ограничений."),
    card("health", "asthma", "Астма", "Нужен контроль воздуха и запас ингаляторов."),
    card("health", "diabetes", "Диабет", "Требуется стабильное питание и медикаменты."),
    card("health", "old_injury", "Старая травма ноги", "Не любит долгие переходы."),
    card("health", "vision", "Плохое зрение", "Без очков почти не видит мелкие детали."),
    card("health", "strong", "Отличная физическая форма", "Может выполнять тяжелую работу."),
    card("health", "allergy", "Сильная аллергия", "Опасны неизвестные растения и пыль."),
    card("health", "immune", "Крепкий иммунитет", "Редко болеет даже в сложных условиях."),
    card("health", "migraine", "Мигрени", "Периодически теряет работоспособность."),
    card("health", "recovery", "Восстановление после операции", "Нужен щадящий режим первые месяцы.")
  ],
  biology: [
    "Отличная память", "Редкая группа крови", "Быстро учится", "Вынослив к холоду", "Хорошо переносит голод", "Не переносит сырость", "Чуткий слух", "Слабый вестибулярный аппарат", "Высокая стрессоустойчивость", "Левша"
  ].map((title, index) => card("biology", String(index + 1), title)),
  hobby: ["Садоводство", "Рыбалка", "Настольные игры", "Ремонт техники", "Бег", "Кулинария", "Радиосвязь", "Шитье", "Туризм", "Изучение языков"].map((title, index) => card("hobby", String(index + 1), title)),
  phobia: ["Боязнь темноты", "Боязнь замкнутых пространств", "Боязнь насекомых", "Боязнь высоты", "Паника при виде крови", "Страх одиночества", "Страх глубины", "Боязнь громких звуков", "Нет выраженной фобии", "Страх заражения"].map((title, index) => card("phobia", String(index + 1), title)),
  baggage: ["Аптечка", "Набор инструментов", "Семена овощей", "Фонарик с батарейками", "Туристический фильтр", "Палатка", "Радиоприемник", "Книга по выживанию", "Теплый спальник", "Коробка консервов", "Солнечная зарядка", "Мультитул"].map((title, index) => card("baggage", String(index + 1), title)),
  skill: ["Первая помощь", "Ремонт электрики", "Очистка воды", "Выращивание еды", "Медиация конфликтов", "Ориентирование", "Охота и ловушки", "Консервация продуктов", "Ведение учета", "Самооборона", "Перевод с английского", "Починка одежды"].map((title, index) => card("skill", String(index + 1), title)),
  character: ["Спокойный", "Упрямый", "Оптимист", "Недоверчивый", "Ответственный", "Импульсивный", "Заботливый", "Саркастичный", "Дисциплинированный", "Любит спорить"].map((title, index) => card("character", String(index + 1), title)),
  fact: ["Знает пять языков", "Имеет опыт жизни в деревне", "Был волонтером в больнице", "Умеет чинить велосипеды", "Прошел курсы спасателя", "Помнит карту региона", "Имеет судимость за драку", "Скрывает беременность партнера", "Когда-то работал на складе", "Знает основы астрономии"].map((title, index) => card("fact", String(index + 1), title))
};

export const bunkerSpecialCards: BunkerSpecialCard[] = [
  { id: "special_reveal_extra", category: "special", type: "reveal_extra", title: "Открыть еще карту", description: "Раскройте одну дополнительную характеристику своего персонажа." },
  { id: "special_hide_card", category: "special", type: "hide_card", title: "Скрыть карту", description: "Спрячьте одну свою раскрытую характеристику до конца раунда." },
  { id: "special_force_reveal", category: "special", type: "force_reveal", title: "Принудительное раскрытие", description: "Заставьте выбранного игрока раскрыть одну характеристику." },
  { id: "special_swap_card", category: "special", type: "swap_card", title: "Обмен фактами", description: "Поменяйте свою дополнительную карту факта на случайную новую." },
  { id: "special_protect_vote", category: "special", type: "protect_vote", title: "Защита от голосования", description: "До конца текущего голосования против вас нельзя голосовать." },
  { id: "special_revote", category: "special", type: "revote", title: "Требование переголосования", description: "После результатов запустите повторное голосование." }
];
