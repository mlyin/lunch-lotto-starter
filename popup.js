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
  
  // Add new restaurant with timestamp and ID
  history.unshift({
    id: restaurant.id,
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
  
  // Load favorites
  const favoritesResult = await chrome.storage.local.get(['favorites']);
  const favorites = new Set(favoritesResult.favorites || []);
  
  if (history.length === 0) {
    historyList.innerHTML = '<div class="history-item">No selections yet</div>';
    return;
  }
  
  historyList.innerHTML = history.map(item => `
    <div class="history-item">
      <span class="restaurant-name">${item.name}</span>
      <span class="timestamp">${new Date(item.timestamp).toLocaleDateString()}</span>
      <button class="favorite-btn ${favorites.has(item.id) ? 'favorited' : ''}" 
              onclick="toggleFavorite('${item.id}')">
        ${favorites.has(item.id) ? '★' : '☆'}
      </button>
    </div>
  `).join('');
}

// Add toggleFavorite function to window scope so it can be called from HTML
window.toggleFavorite = async function(restaurantId) {
  try {
    const favoritesResult = await chrome.storage.local.get(['favorites']);
    let favorites = new Set(favoritesResult.favorites || []);
    
    if (favorites.has(restaurantId)) {
      favorites.delete(restaurantId);
    } else {
      favorites.add(restaurantId);
    }
    
    await chrome.storage.local.set({ favorites: Array.from(favorites) });
    
    // Update the button state immediately
    const button = document.querySelector(`button[onclick="toggleFavorite('${restaurantId}')"]`);
    if (button) {
      button.classList.toggle('favorited');
      button.innerHTML = favorites.has(restaurantId) ? '★' : '☆';
    }
    
    // Update the wheel to reflect changes
    if (typeof drawWheel === 'function') {
      drawWheel();
    }
  } catch (error) {
    console.error('Error toggling favorite:', error);
  }
};

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
          id: place.place_id, // Add unique ID
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
    // Clear the current options array
    options = [];
  
    // Randomly shuffle the restaurants array
    const shuffledRestaurants = [...restaurants].sort(() => Math.random() - 0.5);
  
    // Choose 8 random restaurants
    const selectedRestaurants = shuffledRestaurants.slice(0, 8);
  
    // Set the options array with restaurant names, links, and IDs
    options = selectedRestaurants.map((restaurant) => ({
      id: restaurant.id,
      name: restaurant.name,
      googleMapsLink: restaurant.googleMapsLink
    }));
  
    // Store restaurant details globally
    restaurantDetails = selectedRestaurants.reduce((acc, r) => {
      acc[r.name] = r;
      return acc;
    }, {});
  
    console.log("✅ Options for the Wheel:", options);
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
  // Call the spin function from wheel.js
  if (options.length === 0) {
    alert("Please wait while we load restaurants...");
    return;
  }
  
  // Start the spin animation
  spinAngleStart = Math.random() * 10 + 10;
  spinTime = 0;
  spinTimeTotal = Math.random() * 3000 + 3000;
  rotateWheel();
  
  // The result will be handled in the rotateWheel function in wheel.js
  // which will call addToHistory when the spin is complete
}

// Ensure scripts run only after DOM is loaded
document.addEventListener("DOMContentLoaded", async () => {
  await fetchRestaurants();
  await displayHistory(); // Display initial history

  // Spin button event
  document.getElementById("spin").addEventListener("click", spin);

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