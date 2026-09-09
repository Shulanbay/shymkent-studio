'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function StudioTourPage() {
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    name: '',
    phone: '',
    format: '',
  });

  const [submitted, setSubmitted] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.phone && formData.date && formData.time) {
      setSubmitted(true);
    }
  };

  return (
    <div className="pt-20 min-h-screen bg-bg-light">
      <div className="container-max py-16 md:py-32">
        <div className="max-w-2xl mx-auto">
          <h1 className="mb-4">Бесплатный тур по студии</h1>
          <p className="text-xl text-text-secondary mb-12">
            Запишитесь на экскурсию, чтобы увидеть все три комнаты, оборудование и обсудить ваш проект с нашей командой.
          </p>

          {!submitted ? (
            <div className="bg-white rounded-card p-8 md:p-12 border border-border-light">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div>
                  <h3 className="font-bold text-text-primary mb-2">⏱ Длительность</h3>
                  <p className="text-text-secondary">15 минут</p>
                </div>
                <div>
                  <h3 className="font-bold text-text-primary mb-2">💰 Стоимость</h3>
                  <p className="text-text-secondary">Бесплатно</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block font-semibold text-text-primary mb-2">Дата тура *</label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-border-light rounded-card focus:outline-none focus:ring-2 focus:ring-orange-accent"
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-text-primary mb-2">Время (Шымкент, UTC+5) *</label>
                  <input
                    type="time"
                    name="time"
                    value={formData.time}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-border-light rounded-card focus:outline-none focus:ring-2 focus:ring-orange-accent"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-text-primary mb-2">Ваше имя *</label>
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
                  <label className="block font-semibold text-text-primary mb-2">Какой формат вы хотите снимать? (опционально)</label>
                  <select
                    name="format"
                    value={formData.format}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-border-light rounded-card focus:outline-none focus:ring-2 focus:ring-orange-accent"
                  >
                    <option value="">Не выбрано</option>
                    <option value="podcast">Подкаст</option>
                    <option value="interview">Интервью</option>
                    <option value="roundtable">Круглый стол</option>
                    <option value="other">Другое</option>
                  </select>
                </div>

                <button type="submit" className="btn-primary w-full">
                  Записаться на бесплатный тур
                </button>
              </form>

              <p className="text-center text-sm text-text-secondary mt-6">
                Подтверждение придёт вам на WhatsApp
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-card p-8 md:p-12 border border-border-light text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>

              <h2 className="text-3xl font-bold mb-4 text-text-primary">Спасибо!</h2>

              <p className="text-text-secondary mb-6">
                Ваша заявка на бесплатный тур принята.
              </p>

              <div className="bg-bg-light p-6 rounded-card mb-8">
                <p className="text-sm text-text-secondary mb-2">Дата и время вашего тура:</p>
                <p className="font-semibold text-text-primary text-lg">
                  {new Date(formData.date).toLocaleDateString('ru-RU')} в {formData.time}
                </p>
              </div>

              <p className="text-text-secondary mb-8">
                Мы отправим подтверждение на WhatsApp номер {formData.phone}. Если у вас возникли вопросы, свяжитесь с нами по телефону.
              </p>

              <div className="flex gap-4 flex-col sm:flex-row">
                <Link href="/" className="btn-secondary text-center">
                  На главную
                </Link>
                <a href="https://wa.me/77005030501" target="_blank" rel="noopener noreferrer" className="btn-primary text-center">
                  Написать в WhatsApp
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
