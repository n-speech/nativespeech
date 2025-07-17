  
  // Добавляем логику для бургер-меню

const burger = document.getElementById('burger');
const nav = document.getElementById('nav');
const navLinks = document.querySelectorAll('#nav a');

// Обработка клика по бургеру — открытие/закрытие меню
burger.addEventListener('click', (e) => {
  e.stopPropagation(); // чтобы клик по бургеру не закрывал меню
  nav.classList.toggle('show');
  burger.innerHTML = nav.classList.contains('show') ? '&times;' : '&#9776;';
});

// Обработка клика по ссылкам меню — закрытие меню
navLinks.forEach(link => {
  link.addEventListener('click', () => {
    nav.classList.remove('show');
    burger.innerHTML = '&#9776;';
  });
});

// Закрытие меню при клике вне бургера и меню
document.addEventListener('click', (e) => {
  const isClickInsideNav = nav.contains(e.target);
  const isClickOnBurger = burger.contains(e.target);

  if (!isClickInsideNav && !isClickOnBurger) {
    nav.classList.remove('show');
    burger.innerHTML = '&#9776;';
  }
});

