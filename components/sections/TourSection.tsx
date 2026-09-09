import Link from 'next/link';

export function TourSection() {
  return (
    <section className="py-16 md:py-32 bg-gradient-accent">
      <div className="container-max">
        <div className="max-w-2xl mx-auto text-center text-white">
          <h2 className="mb-4">Приходите познакомиться со студией</h2>

          <p className="text-xl mb-8 text-white/90">
            Хотите сначала увидеть комнаты? Запишитесь на бесплатный тур: покажем пространство и оборудование, обсудим формат вашего подкаста.
          </p>

          <Link href="/studio-tour" className="btn-secondary text-center inline-block">
            Записаться на бесплатный тур
          </Link>
        </div>
      </div>
    </section>
  );
}
