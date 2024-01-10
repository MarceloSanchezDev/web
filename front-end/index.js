let nombre = document.getElementById('nombreCompleto')
let univer = document.getElementById('Universidad')
let cursos = document.getElementById('cursos')
let landing = document.getElementById('servicio-Landing')
let diseño = document.getElementById('servicio-Diseño')
let soporte = document.getElementById('servicio-Soporte')


async function traerDatosPagPrincipal(){
    const resultado = await fetch("http://localhost:1234")
    .then(res => res.json())
    nombre.innerText = `${resultado.Nombre}`+` ${resultado.Apellido}`
    univer.innerText = `${resultado.Estudios.Universidad}`
    cursos.innerHTML = `<li>${resultado.Estudios.Cursos.Frontend}</li>
                        <li>${resultado.Estudios.Cursos.Responsive}</li>
                        <li>${resultado.Estudios.Cursos.React}</li>`
    landing.innerHTML =` <h2>${resultado.Servicios.LandingPages.nombre} <i class="bi bi-file-earmark"></i></h2>
    <blockquote class="servicio-info">${resultado.Servicios.LandingPages.info}</blockquote>
    <picture>
              <img
                src="${resultado.Servicios.LandingPages.img}"
                alt="${resultado.Servicios.LandingPages.nombre}"
              />
            </picture>`
    diseño.innerHTML =` <h2>${resultado.Servicios.DiseñoResponsivo.nombre} <i class="bi bi-phone"></i></h2>
    <blockquote class="servicio-info">${resultado.Servicios.DiseñoResponsivo.info}</blockquote>
    <picture>
              <img
                src="${resultado.Servicios.DiseñoResponsivo.img}"
                alt="${resultado.Servicios.DiseñoResponsivo.nombre}"
              />
            </picture>`
    soporte.innerHTML =` <h2>${resultado.Servicios.Soporte.nombre} <i class="bi bi-gear"></i></h2>
    <blockquote class="servicio-info">${resultado.Servicios.Soporte.info}</blockquote>
    <picture>
              <img
                src="${resultado.Servicios.Soporte.img}"
                alt="${resultado.Servicios.Soporte.nombre}"
              />
            </picture>`

}

document.addEventListener('DOMContentLoaded', traerDatosPagPrincipal);


// Función para comprobar si un elemento está visible en la ventana gráfica
function isElementInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
      rect.bottom >= 0 &&
      rect.right >= 0 &&
      rect.top <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.left <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }
  
  // Función para cargar los componentes cuando estén cerca del viewport
  function lazyLoad() {
    const components = document.querySelectorAll('.componente'); // Reemplaza '.tu-clase-de-componente' con el selector correcto
    components.forEach(component => {
      if (isElementInViewport(component)) {
        // Carga el componente cuando esté en el viewport
        // Aquí puedes hacer una llamada AJAX para cargar contenido dinámico
        // Por ejemplo: component.innerHTML = 'Contenido cargado dinámicamente';
        component.classList.add('loaded'); // Añade una clase CSS para identificar que se ha cargado
      }
    });
  }
  
  // Evento scroll para llamar a la función de carga perezosa
  window.addEventListener('scroll', lazyLoad);
  
  // Llama a lazyLoad() al cargar inicialmente la página
  document.addEventListener('DOMContentLoaded', lazyLoad);


  let form = document.getElementById("my-form");
    
    async function handleSubmit(event) {
      event.preventDefault();
      var status = document.getElementById("my-form-status");
      var data = new FormData(event.target);
      fetch(event.target.action, {
        method: form.method,
        body: data,
        headers: {
            'Accept': 'application/json'
        }
      }).then(response => {
        if (response.ok) {
          status.innerHTML = "Thanks for your submission!";
          form.reset()
        } else {
          response.json().then(data => {
            if (Object.hasOwn(data, 'errors')) {
              status.innerHTML = data["errors"].map(error => error["message"]).join(", ")
            } else {
              status.innerHTML = "Oops! There was a problem submitting your form"
            }
          })
        }
      }).catch(error => {
        status.innerHTML = "Oops! There was a problem submitting your form"
      });
    }
    form.addEventListener("submit", handleSubmit)

    

    
    
  
  
    