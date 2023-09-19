let captchaData;

document.addEventListener("DOMContentLoaded", function () {
  fetchCaptchaImages();
});

function toggleSelection(element) {
  element.classList.toggle("selected");
}

function populateCaptcha(data) {
  const container = document.getElementById("recaptcha-container");
  const title = document.getElementById("recaptcha-title");
  title.innerHTML = data.title;
  const oldRows = container.getElementsByClassName("recaptcha-row");
  while (oldRows.length > 0) {
    oldRows[0].parentNode.removeChild(oldRows[0]);
  }

  const images = data.questions;

  let rows = Math.ceil(images.length / 4);
  let htmlContent = "";
  for (let r = 0; r < rows; r++) {
    htmlContent += '<div class="recaptcha-row">';
    for (let i = 0; i < 4; i++) {
      const index = r * 4 + i;
      if (images[index]) {
        htmlContent += `
          <div class="recaptcha-image" style="background-image: url('${images[index].image}');" onclick="toggleSelection(this)">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path d="M20.285 2l-1.272.02L6.72 15.466l-5.644-5.58L0 12.352l7.218 7.15L24 2.083z"/>
              </svg>
            </div>
        `;
      }
    }
    htmlContent += "</div>";
  }

  title.insertAdjacentHTML("afterend", htmlContent);
  captchaData = data;
}

async function verifyCaptcha() {
  const selectedImages = document.querySelectorAll(".recaptcha-image.selected");
  const answers = [];
  const answerTableBody = document.querySelector("#answer-table tbody");
  const endMessageDiv = document.querySelector("#end-message");
  answerTableBody.innerHTML = "";  

  selectedImages.forEach((img) => {
      const backgroundImageURL = img.style.backgroundImage;
      const imageURL = backgroundImageURL.slice(5, backgroundImageURL.length - 2);
      const question = captchaData.questions.find((q) => q.image === imageURL);
      answers.push(question.id);
      const row = document.createElement("tr");
      const imgCell = document.createElement("td");
      const idCell = document.createElement("td");
      const nameCell = document.createElement("td");
      imgCell.innerHTML = `<img src="${question.image}" alt="Selected Image" width="50">`;
      idCell.textContent = question.answer;
      nameCell.textContent = question.name;
      row.appendChild(imgCell);
      row.appendChild(nameCell);
      row.appendChild(idCell);
      answerTableBody.appendChild(row);
  });
  num_correct = 0
  for (let i = 0; i < captchaData.questions.length; i++) {
    if (captchaData.questions[i].answer == true) {
      num_correct += 1
    }
  }
  endMessageDiv.textContent = `You selected ${selectedImages.length} image(s). There are ${num_correct} correct image(s).`;

  const captchaAnswer = {
      session: captchaData.session,
      answer: answers.join(","),
  };
  try {
      const response = await fetch("/api/verify", {
          method: "POST",
          headers: {
              "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams(captchaAnswer).toString() // Convert JSON object to form-urlencoded data
      });
      const data = await response.json();

      if (data.success) {
          endMessageDiv.textContent = "You have successfully completed the captcha!";
      } else {
          fetchCaptchaImages();
      }
  } catch (error) {
      console.error("Error verifying captcha:", error);
  }
}


const submitButton = document.querySelector(".submit-btn");
submitButton.addEventListener("click", verifyCaptcha);

function fetchCaptchaImages() {
  fetch("/api/affiliation/Hololive")
    .then((response) => response.json())
    .then((data) => {
      populateCaptcha(data);
    })
    .catch((error) => {
      console.error("There was an error fetching the captcha:", error);
    });
}