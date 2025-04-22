const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");

let options = [];  // Changed to let since we modify it
const colors = ["#F69C9E", "#BCECE6", "#73D5D1", "#FFEED9"];
const favoriteColor = "#FFD700"; // Gold color for favorites
let favorites = new Set(); // Store favorite restaurant IDs

// Load favorites from storage when the script starts
chrome.storage.local.get(['favorites'], function(result) {
  if (result.favorites) {
    favorites = new Set(result.favorites);
  }
});

function saveFavorites() {
  chrome.storage.local.set({ favorites: Array.from(favorites) });
}

function toggleFavorite(restaurantId) {
  if (favorites.has(restaurantId)) {
    favorites.delete(restaurantId);
  } else {
    favorites.add(restaurantId);
  }
  saveFavorites();
  drawWheel(); // Redraw the wheel to reflect changes
}

// #051F20 #0B2B26 #163832 #235347 #8EB69B #DAF1DE #F2F2F2
let startAngle = 0;
let arc = 2 * Math.PI / 8;  // Fixed to 8 segments
let spinTimeout = null;
let spinAngleStart = 0;
let spinTime = 0;
let spinTimeTotal = 0;

function scaleCanvas(canvas, ctx) {
    const pixelRatio = window.devicePixelRatio || 1;
  
    // Save the original canvas dimensions
    const width = canvas.width;
    const height = canvas.height;
  
    // Set the canvas width and height to the scaled dimensions
    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;
  
    // Scale the canvas context
    // ctx.scale(pixelRatio, pixelRatio);
  
    // Restore the original canvas dimensions for CSS styling
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // Add click event listener
    canvas.addEventListener('click', handleWheelClick);
}

function isColorDark(color) {
    // Convert hex color to RGB
    const hex = color.replace("#", "");
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
  
    // Calculate brightness using the luminance formula
    const brightness = (0.299 * r + 0.587 * g + 0.114 * b);
    return brightness < 128; // Return true if the color is dark
  }  

function truncateOption(option) {
    if (!option) {
        return "Loading..."; // Provide a fallback for empty options
      }

    if (option.length > 13) {
      return option.slice(0, 10) + "..."; // Keep the first 12 characters and add "..."
    }
    return option; // Return the original string if it's 15 characters or less
  }  
  
  function drawWheel() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas before redrawing
  
    // Set the font size and style
    ctx.font = "bold 24px Poppins";
  
    options.forEach((option, i) => {
      const truncatedOption = truncateOption(option.name); // Truncate the option if necessary
      const angle = startAngle + i * arc;
  
      // Draw the segment
      ctx.fillStyle = favorites.has(option.id) ? favoriteColor : colors[i % colors.length];
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, canvas.height / 2);
      ctx.arc(
        canvas.width / 2,
        canvas.height / 2,
        canvas.width / 2,
        angle,
        angle + arc
      );
      ctx.lineTo(canvas.width / 2, canvas.height / 2);
      ctx.fill();
  
      // Draw favorite star if restaurant is favorited
      if (favorites.has(option.id)) {
        ctx.save();
        ctx.translate(
          canvas.width / 2 + Math.cos(angle + arc / 2) * (canvas.width / 2 - 80),
          canvas.height / 2 + Math.sin(angle + arc / 2) * (canvas.height / 2 - 80)
        );
        ctx.rotate(angle + arc / 2);
        ctx.fillStyle = "#000";
        ctx.font = "20px Arial";
        ctx.fillText("★", -10, 0);
        ctx.restore();
      }
  
      // Determine font color based on segment color
      const fontColor = isColorDark(favorites.has(option.id) ? favoriteColor : colors[i % colors.length]) ? "white" : "black";
  
      // Draw the text
      ctx.save();
      ctx.fillStyle = fontColor; // Set dynamic font color
      ctx.translate(
        canvas.width / 2 + Math.cos(angle + arc / 2) * (canvas.width / 2 - 120),
        canvas.height / 2 + Math.sin(angle + arc / 2) * (canvas.height / 2 - 120)
      );
      ctx.rotate(angle + arc / 2);
      ctx.fillText(truncatedOption, -ctx.measureText(truncatedOption).width / 2, 0); // Use truncated option
      ctx.restore();
    });
  
    // Draw the pointer and center circle
    drawPointer();
    drawCenterCircle();
  }  

  function drawCenterCircle() {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
  
    // Set shadow properties
    ctx.save();
    ctx.shadowBlur = 15; // Shadow blur amount
    ctx.shadowColor = "rgba(0, 0, 0, 0.25)"; // Shadow color
  
    // Draw the shadowed circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, 50, 0, 2 * Math.PI); // Adjust radius as needed
    ctx.fillStyle = "white"; // Center circle color
    ctx.fill();
    ctx.restore();
  
    // Add a border to the center circle (optional)
    ctx.beginPath();
    ctx.arc(centerX, centerY, 50, 0, 2 * Math.PI);
    ctx.lineWidth = 5; // Border width
    ctx.strokeStyle = "#fff"; // Border color
    ctx.stroke();
  }

  function drawPointer() {
    const centerX = canvas.width / 2; // Center of the canvas
  
    // Set shadow properties for the pointer
    ctx.save(); // Save the current context state
    ctx.shadowBlur = 15; // Blur amount for the shadow
    ctx.shadowColor = "rgba(0, 0, 0, 0.25)"; // Shadow color (semi-transparent black)
    ctx.shadowOffsetX = 0; // Horizontal shadow offset
    ctx.shadowOffsetY = 5; // Vertical shadow offset
  
    // Draw the pointer
    ctx.beginPath();
    ctx.moveTo(centerX - 30, 0); // Left corner of the pointer
    ctx.lineTo(centerX + 30, 0); // Right corner of the pointer
    ctx.lineTo(centerX, 80); // Bottom tip of the pointer
    ctx.closePath();
  
    // Fill the pointer
    ctx.fillStyle = "#007BFF"; // Pointer color
    ctx.fill();
  
    // Add a border (with shadow)
    ctx.lineWidth = 15; // Border thickness
    ctx.strokeStyle = "#ffffff"; // Border color
    ctx.stroke();
    ctx.restore(); // Restore the context state to remove shadow effects for subsequent drawings
  }  
  
  function rotateWheel() {
    spinTime += 30;
    
    // Update progress bar
    const progressPercent = Math.min(100, (spinTime / spinTimeTotal) * 100);
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
      progressBar.style.width = `${progressPercent}%`;
    }
    
    if (spinTime >= spinTimeTotal) {
      clearTimeout(spinTimeout);
  
      // Calculate the winning segment
      const degrees = (startAngle * 180) / Math.PI + 90;
      const normalizedDegrees = degrees % 360;
      const selectedIndex = Math.floor(normalizedDegrees / (360 / options.length));
      const selectedOption = options[options.length - 1 - selectedIndex];
      
      if (selectedOption && selectedOption.name) {
        // Motivational messages
        const messages = [
          "Time to fuel your body with something nutritious! 🍎",
          "Great choice! Enjoy your healthy meal. 🌱",
          "A healthy lunch keeps the energy flowing! 💪",
          "Your body will thank you for this meal. 🥗",
          "Eating healthy today sets you up for success! 🏆",
          "Tasty and healthy? You've got it! 🍽️",
          "Healthy food, happy mood! 😊",
        ];
  
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];
  
        // Show result
        swal({
          title: `Selected: ${selectedOption.name}`,
          content: (() => {
            const content = document.createElement("div");
            const paragraph = document.createElement("p");
            const link = document.createElement("a");
            
            paragraph.style.fontSize = "12px";
            paragraph.textContent = randomMessage;
        
            link.href = selectedOption.googleMapsLink;
            link.target = "_blank";
            link.textContent = "View on Google Maps";
            link.style.color = "#a2a2a2";
            link.style.fontSize = "10px";
        
            content.appendChild(paragraph);
            content.appendChild(link);
        
            return content;
          })(),
          icon: "success",
          button: false,
        });
        
        // Add to history
        if (typeof addToHistory === 'function') {
          addToHistory(selectedOption);
        }
      }
      
      return;
    }
  
    startAngle += (spinAngleStart * Math.PI) / 180;
    drawWheel();
    spinTimeout = setTimeout(rotateWheel, 30);
  }

function finalizeWheel() {
  const degrees = (startAngle * 180) / Math.PI + 90; // Convert radians to degrees
  const index = Math.floor((360 - (degrees % 360)) / (360 / options.length)); // Calculate the selected segment
  const selectedOption = options[index];
  
  alert(`Selected option: ${selectedOption}`); // Display the result
}

function spin() {
  if (options.length === 0) {
    alert("Please wait while we load restaurants...");
    return;
  }
  
  // Show progress bar
  const progressContainer = document.getElementById('progress-container');
  if (progressContainer) {
    progressContainer.style.display = 'block';
  }
  
  // Reset progress bar
  const progressBar = document.getElementById('progress-bar');
  if (progressBar) {
    progressBar.style.width = '0%';
  }
  
  spinAngleStart = Math.random() * 10 + 10;
  spinTime = 0;
  spinTimeTotal = Math.random() * 3000 + 3000;
  rotateWheel();
  
  // Hide progress bar after spin completes
  setTimeout(() => {
    if (progressContainer) {
      progressContainer.style.display = 'none';
    }
  }, spinTimeTotal + 500);
}

// Add function to handle wheel clicks
function handleWheelClick(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Calculate angle from center
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const angle = Math.atan2(y - centerY, x - centerX);
    
    // Convert angle to segment index
    let normalizedAngle = angle - startAngle;
    if (normalizedAngle < 0) normalizedAngle += 2 * Math.PI;
    const segmentIndex = Math.floor(normalizedAngle / arc);
    
    // Check if click is within the wheel radius
    const distanceFromCenter = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
    if (distanceFromCenter > 50 && distanceFromCenter < canvas.width / 2) {
        const clickedOption = options[segmentIndex];
        if (clickedOption) {
            toggleFavorite(clickedOption.id);
        }
    }
}

scaleCanvas(canvas, ctx);
drawWheel();