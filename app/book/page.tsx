'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function BookingPage() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    service: 'full',
    room: 'large',
    date: '',
    time: '',
    duration: '90',
    name: '',
    phone: '',
    email: '',
    participants: '2',
    comment: '',
    agreeTerms: false,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const calculatePrice = () => {
    if (formData.service === 'recording') {
      return 20000; // 60 minutes
    } else if (formData.service === 'release') {
      return 40000; // up to 90 minutes + editing
    } else {
      return 60000; // full content package
    }
  };

  const isFormValid = () => {
    return (
      formData.name.trim() &&
      formData.phone.trim() &&
      formData.date &&
      formData.time &&
      formData.agreeTerms
    );
  };

  const rooms = [
    { value: 'large', label: 'Большая подкаст-зона (4 чел)', price: 0 },
    { value: 'small', label: 'Маленькая подкаст-комната (2 чел)', price: 0 },
    { value: 'lounge', label: 'Холл / Living Room (3 чел)', price: 0 },
  ];

  return (
    <div className="pt-20 min-h-screen bg-bg-light">
      <div className="container-max py-16 md:py-32">
        <h1 className="mb-12">Забронировать запись</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Основная форма */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-card p-8 border border-border-light">
              {/* Шаг 1: Выбор услуги */}
              {step === 1 && (
                <div>
                  <h2 className="text-2xl font-bold mb-6 text-text-primary">Шаг 1: Выберите услугу</h2>
                  <div className="space-y-4">
                    <label className="flex items-center p-4 border-2 rounded-card cursor-pointer hover:border-orange-accent transition" style={{ borderColor: formData.service === 'recording' ? '#FF6B24' : '#EDE5DD' }}>
                      <input
                        type="radio"
                        name="service"
                        value="recording"
                        checked={formData.service === 'recording'}
                        onChange={handleInputChange}
                        className="w-5 h-5"
                      />
                      <div className="ml-4 flex-grow">
                        <p className="font-semibold text-text-primary">Starter - Только запись</p>
                        <p className="text-sm text-text-secondary">60 минут съёмки на 3 камеры, исходники через 24 часа</p>
                      </div>
                      <p className="text-lg font-bold text-orange-accent">20 000 ₸</p>
                    </label>

                    <label className="flex items-center p-4 border-2 rounded-card cursor-pointer hover:border-orange-accent transition" style={{ borderColor: formData.service === 'release' ? '#FF6B24' : '#EDE5DD' }}>
                      <input
                        type="radio"
                        name="service"
                        value="release"
                        checked={formData.service === 'release'}
                        onChange={handleInputChange}
                        className="w-5 h-5"
                      />
                      <div className="ml-4 flex-grow">
                        <p className="font-semibold text-text-primary">Pro - Запись + монтаж</p>
                        <p className="text-sm text-text-secondary">До 90 минут + профессиональный монтаж + обработка звука</p>
                      </div>
                      <p className="text-lg font-bold text-orange-accent">40 000 ₸</p>
                    </label>

                    <label className="flex items-center p-4 border-2 rounded-card cursor-pointer hover:border-orange-accent transition" style={{ borderColor: formData.service === 'full' ? '#FF6B24' : '#EDE5DD' }}>
                      <input
                        type="radio"
                        name="service"
                        value="full"
                        checked={formData.service === 'full'}
                        onChange={handleInputChange}
                        className="w-5 h-5"
                      />
                      <div className="ml-4 flex-grow">
                        <p className="font-semibold text-text-primary">Premium - Запись + монтаж + Reels</p>
                        <p className="text-sm text-text-secondary">90 минут + монтаж + контент для социальных сетей</p>
                      </div>
                      <p className="text-lg font-bold text-orange-accent">60 000 ₸</p>
                    </label>
                  </div>

                  <div className="flex gap-4 mt-8">
                    <button onClick={() => setStep(2)} className="btn-primary flex-grow">
                      Далее
                    </button>
                  </div>
                </div>
              )}

              {/* Шаг 2: Выбор комнаты */}
              {step === 2 && (
                <div>
                  <h2 className="text-2xl font-bold mb-6 text-text-primary">Шаг 2: Выберите комнату</h2>
                  <div className="space-y-4">
                    {rooms.map((room) => (
                      <label key={room.value} className="flex items-center p-4 border-2 rounded-card cursor-pointer hover:border-orange-accent transition" style={{ borderColor: formData.room === room.value ? '#FF6B24' : '#EDE5DD' }}>
                        <input
                          type="radio"
                          name="room"
                          value={room.value}
                          checked={formData.room === room.value}
                          onChange={handleInputChange}
                          className="w-5 h-5"
                        />
                        <div className="ml-4 flex-grow">
                          <p className="font-semibold text-text-primary">{room.label}</p>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="flex gap-4 mt-8">
                    <button onClick={() => setStep(1)} className="btn-secondary flex-grow">
                      Назад
                    </button>
                    <button onClick={() => setStep(3)} className="btn-primary flex-grow">
                      Далее
                    </button>
                  </div>
                </div>
              )}

              {/* Шаг 3: Дата и время */}
              {step === 3 && (
                <div>
                  <h2 className="text-2xl font-bold mb-6 text-text-primary">Шаг 3: Дата и время</h2>

                  <div className="space-y-6">
                    <div>
                      <label className="block font-semibold text-text-primary mb-2">Дата съёмки</label>
                      <input
                        type="date"
                        name="date"
                        value={formData.date}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-border-light rounded-card focus:outline-none focus:ring-2 focus:ring-orange-accent"
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-text-primary mb-2">Время (Шымкент, UTC+5) - 24-часовой формат</label>
                      <input
                        type="time"
                        name="time"
                        value={formData.time}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-border-light rounded-card focus:outline-none focus:ring-2 focus:ring-orange-accent"
                        lang="en-GB"
                      />
                    </div>

                    {(formData.service === 'recording' || formData.service === 'full') && (
                      <div>
                        <label className="block font-semibold text-text-primary mb-2">Длительность съёмки</label>
                        <select
                          name="duration"
                          value={formData.duration}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 border border-border-light rounded-card focus:outline-none focus:ring-2 focus:ring-orange-accent"
                        >
                          <option value="60">60 минут</option>
                          <option value="90">90 минут</option>
                          <option value="120">120 минут</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4 mt-8">
                    <button onClick={() => setStep(2)} className="btn-secondary flex-grow">
                      Назад
                    </button>
                    <button onClick={() => setStep(4)} className="btn-primary flex-grow">
                      Далее
                    </button>
                  </div>
                </div>
              )}

              {/* Шаг 4: Контакты */}
              {step === 4 && (
                <div>
                  <h2 className="text-2xl font-bold mb-6 text-text-primary">Шаг 4: Ваши контакты</h2>

                  <div className="space-y-6">
                    <div>
                      <label className="block font-semibold text-text-primary mb-2">Имя *</label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="Ваше имя"
                        className="w-full px-4 py-3 border border-border-light rounded-card focus:outline-none focus:ring-2 focus:ring-orange-accent"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-text-primary mb-2">Телефон / WhatsApp *</label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="+7 700 123 45 67"
                        className="w-full px-4 py-3 border border-border-light rounded-card focus:outline-none focus:ring-2 focus:ring-orange-accent"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-text-primary mb-2">Email</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="your@email.com"
                        className="w-full px-4 py-3 border border-border-light rounded-card focus:outline-none focus:ring-2 focus:ring-orange-accent"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-text-primary mb-2">Количество участников</label>
                      <select
                        name="participants"
                        value={formData.participants}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-border-light rounded-card focus:outline-none focus:ring-2 focus:ring-orange-accent"
                      >
                        <option value="1">1 человек</option>
                        <option value="2">2 человека</option>
                        <option value="3">3 человека</option>
                        <option value="4">4 человека</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-text-primary mb-2">Комментарий (опционально)</label>
                      <textarea
                        name="comment"
                        value={formData.comment}
                        onChange={handleInputChange}
                        placeholder="Расскажите о вашем проекте, формате подкаста и любых особых требованиях..."
                        className="w-full px-4 py-3 border border-border-light rounded-card focus:outline-none focus:ring-2 focus:ring-orange-accent min-h-24"
                      />
                    </div>

                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        name="agreeTerms"
                        checked={formData.agreeTerms}
                        onChange={handleInputChange}
                        className="w-5 h-5 mt-1"
                        required
                      />
                      <span className="text-sm text-text-secondary">
                        Я согласен с <Link href="/terms" className="text-orange-accent hover:underline">условиями бронирования</Link> и <Link href="/privacy" className="text-orange-accent hover:underline">политикой конфиденциальности</Link> *
                      </span>
                    </label>
                  </div>

                  <div className="flex gap-4 mt-8">
                    <button onClick={() => setStep(3)} className="btn-secondary flex-grow">
                      Назад
                    </button>
                    <button onClick={() => setStep(5)} disabled={!isFormValid()} className={`btn-primary flex-grow ${!isFormValid() ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      Перейти к оплате
                    </button>
                  </div>
                </div>
              )}

              {/* Шаг 5: Итоговая проверка */}
              {step === 5 && (
                <div>
                  <h2 className="text-2xl font-bold mb-6 text-text-primary">Проверьте заказ</h2>

                  <div className="space-y-4 mb-8 p-6 bg-bg-light rounded-card">
                    <div className="flex justify-between border-b border-border-light pb-3">
                      <span className="text-text-secondary">Услуга:</span>
                      <span className="font-semibold text-text-primary">
                        {formData.service === 'recording' && 'Запись без монтажа'}
                        {formData.service === 'editing' && 'Монтаж эпизода'}
                        {formData.service === 'full' && 'Полный подкаст'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-border-light pb-3">
                      <span className="text-text-secondary">Комната:</span>
                      <span className="font-semibold text-text-primary">
                        {rooms.find(r => r.value === formData.room)?.label}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-border-light pb-3">
                      <span className="text-text-secondary">Дата и время:</span>
                      <span className="font-semibold text-text-primary">
                        {new Date(formData.date).toLocaleDateString('ru-RU')} в {formData.time}
                      </span>
                    </div>
                    {(formData.service === 'recording' || formData.service === 'full') && (
                      <div className="flex justify-between border-b border-border-light pb-3">
                        <span className="text-text-secondary">Длительность:</span>
                        <span className="font-semibold text-text-primary">{formData.duration} минут</span>
                      </div>
                    )}
                    <div className="flex justify-between border-b border-border-light pb-3">
                      <span className="text-text-secondary">Участников:</span>
                      <span className="font-semibold text-text-primary">{formData.participants}</span>
                    </div>
                    <div className="flex justify-between pt-3">
                      <span className="text-lg font-semibold text-text-primary">Итого:</span>
                      <span className="text-2xl font-bold text-orange-accent">{calculatePrice().toLocaleString()} ₸</span>
                    </div>
                  </div>

                  <div className="p-4 bg-orange-accent/10 rounded-card border border-orange-accent/20 mb-6">
                    <p className="text-sm text-orange-accent font-semibold">⚠ Требуется 100% предоплата через Kaspi</p>
                  </div>

                  <div className="flex gap-4">
                    <button onClick={() => setStep(4)} className="btn-secondary flex-grow">
                      Назад
                    </button>
                    <button className="btn-primary flex-grow">
                      Перейти к оплате Kaspi
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Боковая панель со сводкой */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-white rounded-card p-6 border border-border-light">
              <h3 className="font-bold text-text-primary mb-4">Сводка заказа</h3>

              <div className="space-y-4 mb-6 pb-6 border-b border-border-light">
                <div>
                  <p className="text-sm text-text-secondary">Услуга</p>
                  <p className="font-semibold text-text-primary">
                    {formData.service === 'recording' && 'Запись без монтажа'}
                    {formData.service === 'editing' && 'Монтаж эпизода'}
                    {formData.service === 'full' && 'Полный подкаст'}
                  </p>
                </div>

                {(step >= 2) && (
                  <div>
                    <p className="text-sm text-text-secondary">Комната</p>
                    <p className="font-semibold text-text-primary">
                      {rooms.find(r => r.value === formData.room)?.label.split('(')[0].trim()}
                    </p>
                  </div>
                )}

                {(step >= 3) && formData.date && (
                  <div>
                    <p className="text-sm text-text-secondary">Дата</p>
                    <p className="font-semibold text-text-primary">
                      {new Date(formData.date).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm text-text-secondary mb-2">Стоимость</p>
                <p className="text-3xl font-bold text-orange-accent">
                  {calculatePrice().toLocaleString()} ₸
                </p>
              </div>

              <div className="mt-6 p-4 bg-bg-light rounded-card text-sm text-text-secondary">
                <p className="mb-2">✓ 100% предоплата</p>
                <p className="mb-2">✓ Подтверждение на WhatsApp</p>
                <p>✓ Отмена до 24 часов</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
