import { useState } from "react";
import {
  ShoppingBasket, House, Car, Heart, ShoppingBag, PartyPopper, Phone, BookOpen,
  BriefcaseBusiness, TrendingUp, Gift, Shapes, Coffee, Utensils, Pizza, Apple,
  Cake, Wine, Beer, Fish, Milk, Soup, Sandwich, IceCreamBowl, Bus, Train,
  Plane, Bike, Fuel, ParkingCircle, Ship, Truck, Footprints, Bed, Sofa,
  Lamp, Wrench, Hammer, Paintbrush, Key, Droplets, Zap, Flame, Wifi,
  Laptop, Monitor, Headphones, Camera, Gamepad2, Tv, Smartphone, Printer,
  Dumbbell, Stethoscope, Pill, Hospital, Baby, Dog, Cat, Flower2, TreePine,
  Tent, Mountain, Music, Film, Ticket, Palette, GraduationCap, Languages,
  School, Wallet, Banknote, CreditCard, Landmark, Coins, PiggyBank, Receipt,
  ShieldCheck, Scissors, Shirt, Gem, Watch, CircleDollarSign, type LucideIcon,
} from "lucide-react";

const entries: [string, string, LucideIcon][] = [
  ["food", "Продукты", ShoppingBasket], ["home", "Дом", House], ["car", "Автомобиль", Car],
  ["health", "Здоровье", Heart], ["bag", "Покупки", ShoppingBag], ["fun", "Праздник", PartyPopper],
  ["phone", "Связь", Phone], ["book", "Книги", BookOpen], ["work", "Работа", BriefcaseBusiness],
  ["chart", "Инвестиции", TrendingUp], ["gift", "Подарки", Gift], ["other", "Другое", Shapes],
  ["coffee", "Кофе", Coffee], ["utensils", "Ресторан", Utensils], ["pizza", "Пицца", Pizza],
  ["apple", "Фрукты", Apple], ["cake", "Торт", Cake], ["wine", "Вино", Wine],
  ["beer", "Пиво", Beer], ["fish", "Рыба", Fish], ["milk", "Молоко", Milk],
  ["soup", "Обед", Soup], ["sandwich", "Перекус", Sandwich], ["icecream", "Мороженое", IceCreamBowl],
  ["bus", "Автобус", Bus], ["train", "Поезд", Train], ["plane", "Самолёт", Plane],
  ["bike", "Велосипед", Bike], ["fuel", "Бензин", Fuel], ["parking", "Парковка", ParkingCircle],
  ["ship", "Корабль", Ship], ["truck", "Доставка", Truck], ["walk", "Прогулки", Footprints],
  ["bed", "Отель", Bed], ["sofa", "Мебель", Sofa], ["lamp", "Освещение", Lamp],
  ["wrench", "Ремонт", Wrench], ["hammer", "Инструменты", Hammer], ["paint", "Отделка", Paintbrush],
  ["key", "Аренда", Key], ["water", "Вода", Droplets], ["power", "Электричество", Zap],
  ["gas", "Газ", Flame], ["wifi", "Интернет", Wifi], ["laptop", "Ноутбук", Laptop],
  ["monitor", "Компьютер", Monitor], ["audio", "Наушники", Headphones], ["camera", "Фото", Camera],
  ["games", "Игры", Gamepad2], ["tv", "Телевидение", Tv], ["mobile", "Смартфон", Smartphone],
  ["printer", "Печать", Printer], ["sport", "Спорт", Dumbbell], ["doctor", "Врач", Stethoscope],
  ["pills", "Лекарства", Pill], ["hospital", "Больница", Hospital], ["baby", "Дети", Baby],
  ["dog", "Собака", Dog], ["cat", "Кошка", Cat], ["flowers", "Цветы", Flower2],
  ["garden", "Сад", TreePine], ["camping", "Поход", Tent], ["mountain", "Горы", Mountain],
  ["music", "Музыка", Music], ["film", "Кино", Film], ["ticket", "Билеты", Ticket],
  ["art", "Творчество", Palette], ["education", "Образование", GraduationCap], ["languages", "Языки", Languages],
  ["school", "Школа", School], ["wallet", "Кошелёк", Wallet], ["cash", "Наличные", Banknote],
  ["card", "Карта", CreditCard], ["bank", "Банк", Landmark], ["coins", "Монеты", Coins],
  ["savings", "Накопления", PiggyBank], ["receipt", "Платежи", Receipt], ["insurance", "Страховка", ShieldCheck],
  ["beauty", "Парикмахер", Scissors], ["clothes", "Одежда", Shirt], ["jewelry", "Украшения", Gem],
  ["watch", "Часы", Watch], ["salary", "Зарплата", CircleDollarSign],
];
export const categoryIcons: Record<string, LucideIcon> = Object.fromEntries(entries.map(([key, , icon]) => [key, icon]));

export function CategoryAppearance({ icon, color, onIcon, onColor }: {
  icon: string; color: string; onIcon: (value: string) => void; onColor: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const selected = entries.find(([key]) => key === icon) ?? entries[11];
  const Icon = selected[2];
  const results = entries.filter(([key, label]) => `${key} ${label}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="category-appearance" aria-label="Оформление категории">
    <div className="appearance-preview">
      <span className="category-icon" style={{ color, background: color + "18" }}><Icon size={28} /></span>
      <div><b>{selected[1]}</b><small>Предпросмотр иконки</small></div>
      <label>Цвет<input type="color" value={color} onChange={(e) => onColor(e.target.value)} /></label>
    </div>
    <label>Поиск иконки<input type="search" placeholder="Например, кофе, спорт, дом…" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
    <div className="icon-gallery" role="group" aria-label="Иконки">
      {results.map(([key, label, Item]) => <button type="button" key={key} title={label} aria-label={label}
        aria-pressed={key === icon} className={key === icon ? "chosen" : ""} onClick={() => onIcon(key)}>
        <Item size={24} style={{ color }} /><span>{label}</span>
      </button>)}
    </div>
    <small>{results.length ? `${results.length} из ${entries.length} иконок` : "Иконки не найдены. Попробуйте другое название."}</small>
  </section>;
}
