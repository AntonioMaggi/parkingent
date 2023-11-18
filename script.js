// Ключи API и URL для новой базы данных
const NEW_API_URL = 'https://data.stad.gent/api/explore/v2.1/catalog/datasets/bezetting-parkeergarages-real-time/records?limit=20';
const NEW_API_KEY = '8fd8371c9a31ea6f7edd9be7ed03f1a17a823abd0f3522615b00ceff';

// Ключ API для GraphHopper
const GH_API_KEY = '6a6dbedd-0046-44fb-8dd3-f6bc14b8f9e4';
async function getParkingData() {
    const response = await fetch(NEW_API_URL, {
        headers: { 'Authorization': `Bearer ${NEW_API_KEY}` } // Добавьте этот заголовок
    });
    const data = await response.json();
    return data.map(parking => ({
        naam: parking.name,
        straatnaam: parking.description, // Используйте здесь подходящее поле
        capaciteit: parking.totalcapacity,
        geo_point_2d: { lat: parking.latitude, lon: parking.longitude }, // Скорректируйте эти поля
        url: parking.urllinkaddress
        // Добавьте другие поля по мере необходимости
    }));
}
async function calculateRouteDistanceGraphHopper(lat1, lon1, lat2, lon2) {
    const ghUrl = `https://graphhopper.com/api/1/route?point=${lat1},${lon1}&point=${lat2},${lon2}&vehicle=car&key=${GH_API_KEY}`;
    const response = await fetch(ghUrl);
    const data = await response.json();

    if (data.paths && data.paths.length > 0) {
        return data.paths[0].distance; // Расстояние в метрах
    } else {
        throw new Error('Не удалось рассчитать маршрут');
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
            console.error('Ошибка при расчете расстояния:', error);
            return { ...parking, distance: null };
        }
    }));

    parkingDistances.sort((a, b) => a.distance - b.distance);
    return parkingDistances.filter(parking => parking.distance !== null).slice(0, 5);
}
function displayParkings(parkings, userLat, userLon) {
    const parkingList = document.getElementById('parkingList');
    parkingList.innerHTML = ''; // Очистка списка парковок
    document.getElementById('backButton').style.display = 'inline-block'; // Показ кнопки "назад"

    let displayedParkings = new Set(); // Для отслеживания уникальных парковок

    parkings.forEach(parking => {
        // Проверяем, не была ли парковка уже отображена
        const uniqueId = parking.naam + parking.straatnaam;
        if (displayedParkings.has(uniqueId)) return;
        displayedParkings.add(uniqueId);

        const div = document.createElement('div');
        div.className = 'parking-item'; // Убедитесь, что класс соответствует вашему CSS
        const websiteButton = parking.url ? `<a href="${parking.url}" target="_blank" class="btn btn-secondary">Website</a>` : '';
        
        div.innerHTML = `
            <h2>${parking.naam}</h2>
            <p>Adres: ${parking.straatnaam} ${parking.huisnr || ''}</p>
            <p>Capaciteit: ${parking.capaciteit || 'Niet beschikbaar'}</p>
            <p>Afstand: ${(parking.distance / 1000).toFixed(2)} km</p>
            <div>${websiteButton}</div>
            <button onclick="copyToClipboard('${parking.geo_point_2d.lat}, ${parking.geo_point_2d.lon}')" class="btn btn-primary">Coördinaten kopiëren</button>
            <button onclick="openRouteInMaps(${userLat}, ${userLon}, ${parking.geo_point_2d.lat}, ${parking.geo_point_2d.lon})" class="btn btn-primary">Open in Google Maps</button>
        `;
        parkingList.appendChild(div);
    });
}
function openRouteInMaps(userLat, userLon, parkingLat, parkingLon) {
    if (typeof userLat !== "number" || typeof userLon !== "number" ||
        typeof parkingLat !== "number" || typeof parkingLon !== "number") {
        console.error("Неверные координаты для прокладывания маршрута.");
        return;
    }
    const origin = encodeURIComponent(`${userLat},${userLon}`);
    const destination = encodeURIComponent(`${parkingLat},${parkingLon}`);
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
    window.open(url, '_blank');
}
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('Координаты скопированы в буфер обмена');
    }).catch(err => {
        console.error('Ошибка при копировании: ', err);
    });
}
document.getElementById('findParking').addEventListener('click', function() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async function(position) {
            const userLat = position.coords.latitude;
            const userLon = position.coords.longitude;
            try {
                const parkings = await getParkingData();
                const nearestParkings = await findNearestParkingsGraphHopper(userLat, userLon, parkings);
                displayParkings(nearestParkings, userLat, userLon);
            } catch (error) {
                console.error('Ошибка при запросе к API:', error);
            }
        }, function(error) {
            console.error('Ошибка при получении геолокации:', error);
        });
    } else {
        alert('Геолокация не поддерживается вашим браузером');
    }
});
document.getElementById('backButton').addEventListener('click', function() {
    this.style.display = 'none';
    document.getElementById('parkingList').innerHTML = '';
    document.getElementById('addressInput').value = '';
});
function geocodeAddress(address) {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
    return fetch(nominatimUrl)
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
            } else {
                throw new Error('Адрес не найден');
            }
        });
}
document.getElementById('findParkingByAddress').addEventListener('click', function() {
    const address = document.getElementById('addressInput').value;
    if (address) {
        geocodeAddress(address)
            .then(coords => {
                return getParkingData()
                .then(parkings => {
                    return findNearestParkingsGraphHopper(coords.lat, coords.lon, parkings);
                })
                .then(nearestParkings => {
                    displayParkings(nearestParkings, coords.lat, coords.lon);
                })
                .catch(error => {
                    console.error('Ошибка при запросе к API:', error);
                });
            })
            .catch(error => {
                alert('Ошибка геокодирования: ' + error.message);
            });
    } else {
        alert('Введите корректный адрес.');
    }
});
