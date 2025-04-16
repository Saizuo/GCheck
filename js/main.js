document.addEventListener('DOMContentLoaded', function() {
    // Terminal typing animation
    const terminalLines = document.querySelectorAll('.terminal-body .line:not(:last-child)');
    let delay = 500;
    
    terminalLines.forEach((line, index) => {
        setTimeout(() => {
            line.style.opacity = '1';
            
            // If it's the last visible line, start cursor blinking
            if (index === terminalLines.length - 1) {
                setTimeout(() => {
                    document.querySelector('.cursor').style.opacity = '1';
                }, 500);
            }
        }, delay);
        
        delay += 700; // Increase delay for each line
    });
    
    // Animate metric bars on scroll
    const metricBars = document.querySelectorAll('.bar-fill');
    const chartBars = document.querySelectorAll('.chart-bar');
    
    // Reset initial state
    metricBars.forEach(bar => {
        bar.style.width = '0%';
    });
    
    chartBars.forEach(bar => {
        bar.style.height = '0%';
    });
    
    // Intersection Observer for animations
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Animate metric bars
                if (entry.target.classList.contains('metrics-grid')) {
                    setTimeout(() => {
                        metricBars.forEach(bar => {
                            const targetWidth = bar.getAttribute('style').split('width:')[1].split('%')[0].trim();
                            bar.style.width = targetWidth + '%';
                        });
                    }, 300);
                }
                
                // Animate chart bars
                if (entry.target.classList.contains('activity-chart')) {
                    setTimeout(() => {
                        chartBars.forEach(bar => {
                            const targetHeight = bar.getAttribute('style').split('height:')[1].split('%')[0].trim();
                            bar.style.height = targetHeight + '%';
                        });
                    }, 300);
                }
                
                // Animate feature cards
                if (entry.target.classList.contains('features-grid')) {
                    const cards = entry.target.querySelectorAll('.feature-card');
                    cards.forEach((card, index) => {
                        setTimeout(() => {
                            card.style.opacity = '1';
                            card.style.transform = 'translateY(0)';
                        }, 100 * index);
                    });
                }
                
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.2 });
    
    // Observe elements
    observer.observe(document.querySelector('.metrics-grid'));
    observer.observe(document.querySelector('.activity-chart'));
    observer.observe(document.querySelector('.features-grid'));
    
    // Sticky header
    const header = document.querySelector('header');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });
    
    // Search form handling
    const searchBox = document.querySelector('.search-box');
    const searchInput = searchBox.querySelector('input');
    const analyzeBtn = searchBox.querySelector('.analyze-btn');
    
    analyzeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        
        const repoUrl = searchInput.value.trim();
        
        if (!repoUrl) {
            searchInput.classList.add('error');
            setTimeout(() => {
                searchInput.classList.remove('error');
            }, 1000);
            return;
        }
        
        // Validate GitHub URL format
        const githubUrlPattern = /^(https?:\/\/)?(www\.)?github\.com\/[a-zA-Z0-9-]+\/[a-zA-Z0-9._-]+\/?$/;
        
        if (!githubUrlPattern.test(repoUrl)) {
            searchInput.classList.add('error');
            setTimeout(() => {
                searchInput.classList.remove('error');
            }, 1000);
            return;
        }
        
        // Show loading state
        analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
        analyzeBtn.disabled = true;
        
        // Simulate API call
        setTimeout(() => {
            analyzeBtn.innerHTML = 'Analyze <i class="fas fa-arrow-right"></i>';
            analyzeBtn.disabled = false;
            
            // In a real app, you would redirect to results page
            alert('Repository analysis complete! In a real application, you would see detailed results.');
        }, 2000);
    });
    
    // Example links click handler
    const exampleLinks = document.querySelectorAll('.search-examples a');
    
    exampleLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            searchInput.value = 'github.com/' + link.textContent.trim();
        });
    });
    
    // Mobile menu toggle
    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('nav');
    
    menuToggle.addEventListener('click', () => {
        nav.classList.toggle('active');
        menuToggle.classList.toggle('active');
    });
    
    // Initialize feature cards for animation
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
    });
    
    // Initialize terminal lines for animation
    terminalLines.forEach(line => {
        line.style.opacity = '0';
    });
    document.querySelector('.cursor').style.opacity = '0';
    
    // Add SVG gradient definition for circular progress
    const svgGradient = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgGradient.style.width = '0';
    svgGradient.style.height = '0';
    svgGradient.style.position = 'absolute';
    svgGradient.innerHTML = `
        <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="var(--accent-primary)" />
                <stop offset="100%" stop-color="var(--accent-tertiary)" />
            </linearGradient>
        </defs>
    `;
    document.body.appendChild(svgGradient);
});

document.addEventListener('DOMContentLoaded', function() {
    // Get the analyze button and input field from the index page
    const analyzeBtn = document.querySelector('.hero .analyze-btn');
    const repoInput = document.querySelector('.hero .search-box input');
    
    // Add click event listener to the analyze button
    if (analyzeBtn && repoInput) {
        analyzeBtn.addEventListener('click', function() {
            const repoUrl = repoInput.value.trim();
            
            if (!repoUrl) {
                alert('Please enter a GitHub repository URL');
                return;
            }
            
            // Extract the repository information from the input
            let repoPath;
            
            // Handle different input formats
            if (repoUrl.includes('github.com')) {
                // Extract from full GitHub URL
                const urlParts = repoUrl.split('github.com/');
                if (urlParts.length > 1) {
                    repoPath = urlParts[1].replace(/^\/+|\/+$/g, ''); // Remove leading/trailing slashes
                }
            } else {
                // Assume format is username/repo
                repoPath = repoUrl.replace(/^\/+|\/+$/g, '');
            }
            
            // Validate that we have a username/repo format
            if (repoPath && repoPath.includes('/')) {
                // Redirect to the dashboard page with the repo parameter
                window.location.href = `dashboard.html?repo=${encodeURIComponent(repoPath)}`;
            } else {
                alert('Invalid repository format. Please use username/repository or github.com/username/repository');
            }
        });
    }
    
    // Also handle the example repository links
    const exampleLinks = document.querySelectorAll('.search-examples a');
    
    exampleLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Get the repository name from the link text
            const repoName = this.textContent.trim();
            
            // Set the input value
            if (repoInput) {
                repoInput.value = repoName;
            }
        });
    });
});
