const GH_API_KEY = '6a6dbedd-0046-44fb-8dd3-f6bc14b8f9e4';

async function calculateRouteDistanceGraphHopper(lat1, lon1, lat2, lon2) {
    const ghUrl = `https://graphhopper.com/api/1/route?point=${lat1},${lon1}&point=${lat2},${lon2}&vehicle=car&key=${GH_API_KEY}`;
    const response = await fetch(ghUrl);
    const data = await response.json();

    if (data.paths && data.paths.length > 0) {
        return data.paths[0].distance; 
    } else {
        throw new Error('Kan route niet verwerken');
    }
}

async function findNearestParkingsGraphHopper(userLat, userLon, parkings) {
    const parkingDistances = await Promise.all(parkings.map(async (parking) => {
        const parkingLat = parking.geo_point_2d.lat;
        const parkingLon = parking.geo_point_2d.lon;
        try {
            const distance = await calculateRouteDistanceGraphHopper(userLat, userLon, parkingLat, parkingLon);
            return { ...parking, distance };
        } catch (error) {
            console.error('Fout bij het berekenen van de afstand:', error);
            return { ...parking, distance: null };
        }
    }));

    parkingDistances.sort((a, b) => a.distance - b.distance);
    return parkingDistances.filter(parking => parking.distance !== null).slice(0, 5);
}

function displayParkings(parkings, userLat, userLon) {
    document.getElementById('loadingSpinner').style.display = 'none';
    const parkingList = document.getElementById('parkingList');
    parkingList.innerHTML = ''; // Opschonen van de parkeerlijst
    document.getElementById('backButton').style.display = 'inline-block'; // Toon de 'Terug'-knop

    parkings.forEach(parking => {
        // Het aanmaken van een parkeerelement
        const div = document.createElement('div');
        div.className = 'parking-item';
        const websiteButton = parking.url ? `<a href="${parking.url}" target="_blank" class="btn btn-secondary">Website</a>` : '';

        // Het aanmaken van een parkeerelement
        div.innerHTML = `
            <h2>${parking.naam}</h2>
            <p>Adres: ${parking.straatnaam} ${parking.huisnr || ''}</p>
            <p>Capaciteit: ${parking.capaciteit || 'Niet beschikbaar'}</p>
            <p>Afstand: ${(parking.distance / 1000).toFixed(2)} km</p>
            <div>${websiteButton}</div>
            <button onclick="copyToClipboard('${parking.geo_point_2d.lat}, ${parking.geo_point_2d.lon}')" class="btn btn-primary">Coördinaten kopiëren</button>
        `;

         // Het creëren en toevoegen van de knop 'Openen in Google Maps
         const openMapButton = document.createElement('button');
         openMapButton.textContent = 'Open in Google Maps';
         openMapButton.classList.add('btn', 'btn-secondary');
         openMapButton.onclick = () => openInMaps(parking.geo_point_2d.lat, parking.geo_point_2d.lon);
         div.appendChild(openMapButton);
         
        // Het creëren en toevoegen van de knop 'Route plannen
        const routeButton = document.createElement('button');
        routeButton.textContent = 'Route plannen';
        routeButton.classList.add('btn', 'btn-primary');
        routeButton.onclick = () => openRouteInMaps(userLat, userLon, parking.geo_point_2d.lat, parking.geo_point_2d.lon);
        div.appendChild(routeButton);

        // Het creëren en toevoegen van de knop 'Route plannen
        const qrCodeElement = document.createElement('div');
        qrCodeElement.classList.add('qr-code-container');
        div.appendChild(qrCodeElement);

        // Genereren en toevoegen van een QR-code in de container
        new QRCode(qrCodeElement, {
            text: `https://www.google.com/maps?q=${parking.geo_point_2d.lat},${parking.geo_point_2d.lon}`,
            width: 128,
            height: 128,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });

        // Het toevoegen van de gehele blok aan de lijst op de pagina
        parkingList.appendChild(div);
    });
}

function openInMaps(parkingLat, parkingLon) {
    if (typeof parkingLat !== "number" || typeof parkingLon !== "number") {
        console.error("Ongeldige coördinaten voor het weergeven van de kaart.");
        return;
    }

    const location = encodeURIComponent(`${parkingLat},${parkingLon}`);
    const url = `https://www.google.com/maps?q=${location}`;
    window.open(url, '_blank');
}

function openRouteInMaps(userLat, userLon, parkingLat, parkingLon) {
    // Ervoor zorgen dat alle parameters getallen zijn
    if (typeof userLat !== "number" || typeof userLon !== "number" ||
        typeof parkingLat !== "number" || typeof parkingLon !== "number") {
        console.error("Onjuiste coördinaten voor routeplanning.");
        return;
    }

    //Een URL aanmaken met deze parameters
    const origin = encodeURIComponent(`${userLat},${userLon}`);
    const destination = encodeURIComponent(`${parkingLat},${parkingLon}`);
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
    window.open(url, '_blank');
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('Coördinaten gekopieerd naar klembord');
    }).catch(err => {
        console.error('Fout tijdens het kopiëren: ', err);
    });
}

document.getElementById('findParking').addEventListener('click', function() {
    document.getElementById('loadingSpinner').style.display = 'block';
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async function(position) {
            const userLat = position.coords.latitude;
            const userLon = position.coords.longitude;
            try {
                const response = await fetch('https://data.stad.gent/api/v2/catalog/datasets/locaties-openbare-parkings-gent/exports/json');
                const parkings = await response.json();
                const nearestParkings = await findNearestParkingsGraphHopper(userLat, userLon, parkings);
                displayParkings(nearestParkings, userLat, userLon);
            } catch (error) {
                console.error('Fout bij het aanvragen van de API:', error);
            }
        }, function(error) {
            console.error('Fout bij ophalen van geolocatie:', error);
        });
    } else {
        alert('Geolocatie wordt niet ondersteund door uw browser');
    }
});

document.getElementById('backButton').addEventListener('click', function() {
    this.style.display = 'none'; // Knop "terug" verbergen
    document.getElementById('parkingList').innerHTML = ''; //Lijst met parkeerplaatsen wissen
    document.getElementById('addressInput').value = ''; // Adresinvoer wissen
});

// Functie toevoegen voor het geocoderen van een adres
function geocodeAddress(address) {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;

    return fetch(nominatimUrl)
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
            } else {
                throw new Error('Geen resultaten gevonden voor dit adres');
            }
        });
}

// Eventhandler voor de knop voor adreszoeken
document.getElementById('findParkingByAddress').addEventListener('click', function() {
    document.getElementById('loadingSpinner').style.display = 'block';
    const address = document.getElementById('addressInput').value;
    if (address) {
        geocodeAddress(address)
            .then(coords => {
                fetch('https://data.stad.gent/api/v2/catalog/datasets/locaties-openbare-parkings-gent/exports/json')
                .then(response => response.json())
                .then(parkings => {
                    return findNearestParkingsGraphHopper(coords.lat, coords.lon, parkings);
                })
                .then(nearestParkings => {
                    displayParkings(nearestParkings, coords.lat, coords.lon);
                })
                .catch(error => {
                    console.error('Fout bij het aanvragen van de API:', error);
                });
            })
            .catch(error => {
                alert('Fout bij het geocoding: ' + error.message);
            });
    } else {
        alert('Voer een geldig adres in.');
    }
});
