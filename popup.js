const apiKey = "AIzaSyACk5tRFZfza8AtADSB94ic865R28gIteU";
const defaultSettings = {
  distance: 0.5,       // Default search radius in miles
  price: "2,3",        // Google Places API uses 1-4 ($ - $$$$)
  dietary: "",         // Empty means no filter (future: vegetarian, gluten-free, etc.)
  history: [],         // Array to store restaurant history
};
// Convert miles to meters (Google Maps API uses meters)
function milesToMeters(miles) {
  return miles * 1609.34;
}

// Load user settings or use defaults
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(defaultSettings, (settings) => {
      resolve(settings);
    });
  });
}

// Update progress bar
function updateProgress(percent, text) {
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  progressBar.style.setProperty('--progress', `${percent}%`);
  progressBar.style.width = `${percent}%`;
  progressText.textContent = text;
}

// Add restaurant to history
async function addToHistory(restaurant) {
  const settings = await loadSettings();
  const history = settings.history || [];
  
  // Add new restaurant with timestamp
  history.unshift({
    name: restaurant.name,
    timestamp: new Date().toISOString(),
    googleMapsLink: restaurant.googleMapsLink
  });
  
  // Keep only last 10 entries
  if (history.length > 10) {
    history.pop();
  }
  
  // Save updated history
  await chrome.storage.sync.set({ history });
  
  // Update history display
  displayHistory();
}

// Display history
async function displayHistory() {
  const settings = await loadSettings();
  const historyList = document.getElementById('history-list');
  const history = settings.history || [];
  
  historyList.innerHTML = history.map(item => `
    <div class="history-item">
      <span class="restaurant-name">${item.name}</span>
      <span class="timestamp">${new Date(item.timestamp).toLocaleDateString()}</span>
    </div>
  `).join('');
}

async function fetchRestaurants() {
    try {
      // Show progress container and hide wheel
      document.getElementById("loading-gif").style.display = "block";
      document.getElementById("progress-container").style.display = "block";
      document.getElementById("wheel").style.display = "none";
      
      updateProgress(20, "Getting your location...");
  
      navigator.geolocation.getCurrentPosition(async (position) => {
        updateProgress(40, "Location found! Searching for restaurants...");
        
        const { latitude: lat, longitude: lng } = position.coords;
        const settings = await loadSettings();
  
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${milesToMeters(settings.distance)}&type=restaurant&keyword=healthy&minprice=${settings.price[0]}&maxprice=${settings.price[2]}&key=${apiKey}`;
  
        updateProgress(60, "Fetching restaurant data...");
        const response = await fetch(url);
        const data = await response.json();
  
        if (!data.results || data.results.length === 0) {
          console.error("❌ No restaurants found!");
          alert("No restaurants found! Try adjusting your settings.");
          return;
        }
  
        updateProgress(80, "Processing restaurant data...");
        
        // ✅ Extract restaurant data
        let restaurants = data.results.map((place) => ({
          name: place.name,
          distance: (settings.distance).toFixed(1),
          price: place.price_level ? "$".repeat(place.price_level) : "Unknown",
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng,
          placeId: place.place_id,
          googleMapsLink: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`, // Add Google Maps link
        }));
  
        // ✅ Remove duplicate restaurant names
        const seen = new Set();
        restaurants = restaurants.filter((restaurant) => {
          if (seen.has(restaurant.name)) {
            return false; // Duplicate found, skip this restaurant
          }
          seen.add(restaurant.name);
          return true; // Unique restaurant, keep it
        });
  
        console.log("✅ Unique Restaurants fetched:", restaurants);
  
        // ✅ Store restaurant details globally
        restaurantDetails = restaurants.reduce((acc, r) => {
          acc[r.name] = r;
          return acc;
        }, {});
  
        updateProgress(100, "Ready to spin!");
        
        // Hide loading elements and show wheel after a short delay
        setTimeout(() => {
          document.getElementById("loading-gif").style.display = "none";
          document.getElementById("progress-container").style.display = "none";
          document.getElementById("wheel").style.display = "block";
          updateWheel(restaurants);
        }, 1000);
  
      }, (error) => {
        console.error("❌ Geolocation error:", error);
        alert("Please enable location access to fetch restaurants.");
        document.getElementById("loading-gif").style.display = "none";
        document.getElementById("progress-container").style.display = "none";
        document.getElementById("wheel").style.display = "block";
      });
    } catch (error) {
      console.error("❌ Error fetching restaurants:", error);
      document.getElementById("loading-gif").style.display = "none";
      document.getElementById("progress-container").style.display = "none";
      document.getElementById("wheel").style.display = "block";
    }
}

function updateWheel(restaurants) {
    options.length = 0; // Clear the current options array
  
    // Randomly shuffle the restaurants array
    const shuffledRestaurants = [...restaurants].sort(() => Math.random() - 0.5);
  
    // Choose 8 random restaurants
    const selectedRestaurants = shuffledRestaurants.slice(0, 8);
  
    // Extract restaurant names and Google Maps links, and populate options array
    options.push(...selectedRestaurants.map((restaurant) => ({
      name: restaurant.name,
      googleMapsLink: restaurant.googleMapsLink, // Add Google Maps link
    })));
  
    // Debugging: Log the selected restaurants with their links
    console.log("✅ Options for the Wheel:", options);
  
    // Store full restaurant details, including names and links
    restaurantDetails = selectedRestaurants.map((restaurant) => ({
      name: restaurant.name,
      googleMapsLink: restaurant.googleMapsLink // Add the Google Maps link
    }));
  
    console.log("✅ Selected Restaurants for the Wheel:", restaurantDetails);
  
    // Redraw the wheel with the updated options
    drawWheel();
  }  

// 🛠️ Toggle Settings View
function showSettings() {
  document.getElementById("main-view").style.display = "none";
  document.getElementById("settings-view").style.display = "block";
}

function hideSettings() {
  document.getElementById("main-view").style.display = "block";
  document.getElementById("settings-view").style.display = "none";
}

// Modify the spin function to add to history
function spin() {
  const result = spinWheel();
  if (result) {
    const selectedRestaurant = restaurantDetails.find(r => r.name === result);
    if (selectedRestaurant) {
      document.getElementById("selected-restaurant").textContent = result;
      document.getElementById("google-maps-link").href = selectedRestaurant.googleMapsLink;
      document.getElementById("google-maps-link").style.display = "block";
      document.getElementById("result-container").style.display = "block";
      
      // Add to history
      addToHistory(selectedRestaurant);
    }
  }
}

// Ensure scripts run only after DOM is loaded
document.addEventListener("DOMContentLoaded", async () => {
  await fetchRestaurants();
  await displayHistory(); // Display initial history

  // Spin button event
  document.getElementById("spin").addEventListener("click", () => spin());

  // Open settings view
  document.getElementById("open-settings").addEventListener("click", showSettings);

  // Close settings view
  document.getElementById("close-settings").addEventListener("click", hideSettings);

  // Load saved settings into inputs
  const settings = await loadSettings();
  document.getElementById("distance").value = settings.distance;
  document.getElementById("price").value = settings.price;

  // Save settings
  document.getElementById("save-settings").addEventListener("click", async () => {
    const distance = parseFloat(document.getElementById("distance").value);
    const price = document.getElementById("price").value;
  
    // Save the updated settings
    chrome.storage.sync.set({ distance, price }, async () => {
      swal({
        title: `Settings saved!`,
        icon: "success",
        button: false, // Hide the default OK button
      });
  
      // Hide the settings view and fetch new restaurants
      hideSettings();
      await fetchRestaurants(); // Fetch restaurants with the new settings
    });
  });  
});