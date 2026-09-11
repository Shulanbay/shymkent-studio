'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageContext';
import { getTranslation } from '@/lib/translations';

export default function BookingPage() {
  const { language } = useLanguage();
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

  const getRooms = () => [
    { value: 'large', labelKey: 'booking.largeRoom', price: 0 },
    { value: 'small', labelKey: 'booking.smallRoom', price: 0 },
    { value: 'lounge', labelKey: 'booking.loungeRoom', price: 0 },
  ];

  const rooms = getRooms();

  return (
    <div className="pt-20 min-h-screen bg-bg-light">
      <div className="container-max py-16 md:py-32">
        <h1 className="mb-12">{getTranslation(language, 'booking.title')}</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Основная форма */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-card p-8 border border-border-light">
              {/* Шаг 1: Выбор услуги */}
              {step === 1 && (
                <div>
                  <h2 className="text-2xl font-bold mb-6 text-text-primary">{getTranslation(language, 'booking.step1Title')}</h2>
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
                        <p className="font-semibold text-text-primary">{getTranslation(language, 'booking.starterLabel')}</p>
                        <p className="text-sm text-text-secondary">{getTranslation(language, 'booking.starterDesc')}</p>
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
                        <p className="font-semibold text-text-primary">{getTranslation(language, 'booking.proLabel')}</p>
                        <p className="text-sm text-text-secondary">{getTranslation(language, 'booking.proDesc')}</p>
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
                        <p className="font-semibold text-text-primary">{getTranslation(language, 'booking.premiumLabel')}</p>
                        <p className="text-sm text-text-secondary">{getTranslation(language, 'booking.premiumDesc')}</p>
                      </div>
                      <p className="text-lg font-bold text-orange-accent">60 000 ₸</p>
                    </label>
                  </div>

                  <div className="flex gap-4 mt-8">
                    <button onClick={() => setStep(2)} className="btn-primary flex-grow">
                      {getTranslation(language, 'booking.next')}
                    </button>
                  </div>
                </div>
              )}

              {/* Шаг 2: Выбор комнаты */}
              {step === 2 && (
                <div>
                  <h2 className="text-2xl font-bold mb-6 text-text-primary">{getTranslation(language, 'booking.step2Title')}</h2>
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
                          <p className="font-semibold text-text-primary">{getTranslation(language, room.labelKey)}</p>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="flex gap-4 mt-8">
                    <button onClick={() => setStep(1)} className="btn-secondary flex-grow">
                      {getTranslation(language, 'booking.back')}
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
                  <h2 className="text-2xl font-bold mb-6 text-text-primary">{getTranslation(language, 'booking.step3Title')}</h2>

                  <div className="space-y-6">
                    <div>
                      <label className="block font-semibold text-text-primary mb-2">{getTranslation(language, 'booking.recordingDate')}</label>
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
                      <label className="block font-semibold text-text-primary mb-2">{getTranslation(language, 'booking.recordingTime')}</label>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <input
                            type="number"
                            placeholder="ЧЧ"
                            min="0"
                            max="23"
                            value={formData.time.split(':')[0] || ''}
                            onChange={(e) => {
                              const hour = e.target.value.padStart(2, '0');
                              const minute = formData.time.split(':')[1] || '00';
                              setFormData(prev => ({
                                ...prev,
                                time: hour && minute ? `${hour}:${minute}` : ''
                              }));
                            }}
                            className="w-full px-4 py-3 border border-border-light rounded-card focus:outline-none focus:ring-2 focus:ring-orange-accent"
                          />
                        </div>
                        <div className="flex items-center text-text-primary font-bold">:</div>
                        <div className="flex-1">
                          <input
                            type="number"
                            placeholder="МИ"
                            min="0"
                            max="59"
                            value={formData.time.split(':')[1] || ''}
                            onChange={(e) => {
                              const hour = formData.time.split(':')[0] || '00';
                              const minute = e.target.value.padStart(2, '0');
                              setFormData(prev => ({
                                ...prev,
                                time: hour && minute ? `${hour}:${minute}` : ''
                              }));
                            }}
                            className="w-full px-4 py-3 border border-border-light rounded-card focus:outline-none focus:ring-2 focus:ring-orange-accent"
                          />
                        </div>
                      </div>
                    </div>

                    {(formData.service === 'recording' || formData.service === 'full') && (
                      <div>
                        <label className="block font-semibold text-text-primary mb-2">{getTranslation(language, 'booking.recordingDuration')}</label>
                        <select
                          name="duration"
                          value={formData.duration}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 border border-border-light rounded-card focus:outline-none focus:ring-2 focus:ring-orange-accent"
                        >
                          <option value="60">60 {getTranslation(language, 'process.subtitle').split(' ')[0]}</option>
                          <option value="90">90 {getTranslation(language, 'process.subtitle').split(' ')[0]}</option>
                          <option value="120">120 {getTranslation(language, 'process.subtitle').split(' ')[0]}</option>
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
                  <h2 className="text-2xl font-bold mb-6 text-text-primary">{getTranslation(language, 'booking.step4Title')}</h2>

                  <div className="space-y-6">
                    <div>
                      <label className="block font-semibold text-text-primary mb-2">{getTranslation(language, 'booking.nameLabel')}</label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder={getTranslation(language, 'booking.namePlaceholder')}
                        className="w-full px-4 py-3 border border-border-light rounded-card focus:outline-none focus:ring-2 focus:ring-orange-accent"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-text-primary mb-2">{getTranslation(language, 'booking.phoneLabel')}</label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder={getTranslation(language, 'booking.phonePlaceholder')}
                        className="w-full px-4 py-3 border border-border-light rounded-card focus:outline-none focus:ring-2 focus:ring-orange-accent"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-text-primary mb-2">{getTranslation(language, 'booking.emailLabel')}</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder={getTranslation(language, 'booking.emailPlaceholder')}
                        className="w-full px-4 py-3 border border-border-light rounded-card focus:outline-none focus:ring-2 focus:ring-orange-accent"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-text-primary mb-2">{getTranslation(language, 'booking.participantsLabel')}</label>
                      <select
                        name="participants"
                        value={formData.participants}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-border-light rounded-card focus:outline-none focus:ring-2 focus:ring-orange-accent"
                      >
                        <option value="1">{getTranslation(language, 'booking.person1')}</option>
                        <option value="2">{getTranslation(language, 'booking.person2')}</option>
                        <option value="3">{getTranslation(language, 'booking.person3')}</option>
                        <option value="4">{getTranslation(language, 'booking.person4')}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-text-primary mb-2">{getTranslation(language, 'booking.commentLabel')}</label>
                      <textarea
                        name="comment"
                        value={formData.comment}
                        onChange={handleInputChange}
                        placeholder={getTranslation(language, 'booking.commentPlaceholder')}
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
                        {getTranslation(language, 'booking.agreeTerms').replace('условиями бронирования', '').replace('политикой конфиденциальности', '').includes('Я согласен') ? (
                          <>
                            Я согласен с <Link href="/terms" className="text-orange-accent hover:underline">{getTranslation(language, 'footer.terms')}</Link> и <Link href="/privacy" className="text-orange-accent hover:underline">{getTranslation(language, 'footer.privacy')}</Link> *
                          </>
                        ) : getTranslation(language, 'booking.agreeTerms')}
                      </span>
                    </label>
                  </div>

                  <div className="flex gap-4 mt-8">
                    <button onClick={() => setStep(3)} className="btn-secondary flex-grow">
                      Назад
                    </button>
                    <button onClick={() => setStep(5)} disabled={!isFormValid()} className={`btn-primary flex-grow ${!isFormValid() ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      {getTranslation(language, 'booking.checkout')}
                    </button>
                  </div>
                </div>
              )}

              {/* Шаг 5: Итоговая проверка */}
              {step === 5 && (
                <div>
                  <h2 className="text-2xl font-bold mb-6 text-text-primary">{getTranslation(language, 'booking.step5Title')}</h2>

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
                        {getTranslation(language, rooms.find(r => r.value === formData.room)?.labelKey || '')}
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
                      {getTranslation(language, 'booking.checkoutKaspi')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Боковая панель со сводкой */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-white rounded-card p-6 border border-border-light">
              <h3 className="font-bold text-text-primary mb-4">{getTranslation(language, 'booking.orderSummary')}</h3>

              <div className="space-y-4 mb-6 pb-6 border-b border-border-light">
                <div>
                  <p className="text-sm text-text-secondary">{getTranslation(language, 'booking.service')}</p>
                  <p className="font-semibold text-text-primary">
                    {formData.service === 'recording' && 'Запись без монтажа'}
                    {formData.service === 'editing' && 'Монтаж эпизода'}
                    {formData.service === 'full' && 'Полный подкаст'}
                  </p>
                </div>

                {(step >= 2) && (
                  <div>
                    <p className="text-sm text-text-secondary">{getTranslation(language, 'booking.room')}</p>
                    <p className="font-semibold text-text-primary">
                      {getTranslation(language, rooms.find(r => r.value === formData.room)?.labelKey || '').split('(')[0].trim()}
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
