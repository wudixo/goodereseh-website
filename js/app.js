const form = document.getElementById("contactForm");

if (form) {

    form.addEventListener("submit", async function (event) {

        event.preventDefault();

        const formData = new FormData(form);

        try {

            const response = await fetch(form.action, {

                method: "POST",

                body: formData,

                headers: {
                    Accept: "application/json"
                }

            });

            if (response.ok) {

                window.location.href = "thank-you.html";

            } else {

                alert("Something went wrong. Please try again.");

            }

        } catch (error) {

            alert("Unable to send your enquiry. Please check your internet connection.");

        }

    });

}