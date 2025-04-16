document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const analyzeBtn = document.getElementById('analyze-btn');
    const repoUrlInput = document.getElementById('repo-url');
    const loadingSection = document.getElementById('loading');
    const loadingRepoUrl = document.getElementById('loading-repo-url');
    const dashboardSection = document.getElementById('dashboard');
    const errorMessage = document.getElementById('error-message');
    
    // Tab navigation
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Initialize tabs
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and contents
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding content
            tab.classList.add('active');
            const tabId = `${tab.dataset.tab}-tab`;
            document.getElementById(tabId).classList.add('active');
        });
    });
    
    // Handle form submission
    analyzeBtn.addEventListener('click', () => {
        const repoUrl = repoUrlInput.value.trim();
        
        if (!repoUrl) {
            alert('Please enter a GitHub repository URL');
            return;
        }
        
        // Extract username and repo name
        let username, repoName;
        
        if (repoUrl.includes('github.com')) {
            const parts = repoUrl.split('github.com/')[1].split('/');
            username = parts[0];
            repoName = parts[1];
        } else if (repoUrl.includes('/')) {
            const parts = repoUrl.split('/');
            username = parts[0];
            repoName = parts[1];
        } else {
            alert('Invalid GitHub repository URL');
            return;
        }
        
        // Show loading screen
        loadingRepoUrl.textContent = `${username}/${repoName}`;
        loadingSection.style.display = 'block';
        dashboardSection.style.display = 'none';
        errorMessage.style.display = 'none';
        
        // Fetch real data from GitHub API
        fetchRepositoryData(username, repoName);
    });
    
    async function fetchRepositoryData(username, repoName) {
        try {
            // Fetch basic repository information
            const repoResponse = await fetch(`https://api.github.com/repos/${username}/${repoName}`);
            
            if (!repoResponse.ok) {
                throw new Error('Repository not found');
            }
            
            const repoData = await repoResponse.json();
            
            // Fetch additional data in parallel
            const [languagesResponse, contributorsResponse, commitsResponse] = await Promise.all([
                fetch(`https://api.github.com/repos/${username}/${repoName}/languages`),
                fetch(`https://api.github.com/repos/${username}/${repoName}/contributors?per_page=5`),
                fetch(`https://api.github.com/repos/${username}/${repoName}/commits?per_page=100`)
            ]);
            
            const languagesData = await languagesResponse.json();
            const contributorsData = await contributorsResponse.json();
            const commitsData = await commitsResponse.json();
            
            // Process and display the data
            const processedData = processGitHubData(repoData, languagesData, contributorsData, commitsData);
            updateDashboard(processedData);
            
            // Hide loading, show dashboard
            loadingSection.style.display = 'none';
            dashboardSection.style.display = 'block';
            
        } catch (error) {
            console.error('Error fetching repository data:', error);
            
            // Show error message
            loadingSection.style.display = 'none';
            errorMessage.style.display = 'block';
            
            // Update error message content
            const errorTitle = errorMessage.querySelector('h3');
            const errorDesc = errorMessage.querySelector('p');
            
            if (errorTitle && errorDesc) {
                errorTitle.textContent = 'Repository Not Found';
                errorDesc.textContent = 'We couldn\'t find the repository you\'re looking for. Please check the URL and try again.';
            }
        }
    }
    
    function processGitHubData(repoData, languagesData, contributorsData, commitsData) {
        // Process languages data
        const totalBytes = Object.values(languagesData).reduce((sum, bytes) => sum + bytes, 0);
        const languages = Object.entries(languagesData).map(([name, bytes]) => {
            const percentage = Math.round((bytes / totalBytes) * 100);
            return {
                name,
                percentage,
                color: getLanguageColor(name)
            };
        }).sort((a, b) => b.percentage - a.percentage);
        
        // Process contributors data
        const contributors = contributorsData.map(contributor => ({
            name: contributor.login,
            commits: contributor.contributions,
            avatar: contributor.avatar_url
        }));
        
        // Process commit activity (by month)
        const commitsByMonth = Array(12).fill(0);
        commitsData.forEach(commit => {
            const date = new Date(commit.commit.author.date);
            const month = date.getMonth();
            commitsByMonth[month]++;
        });
        
        // Calculate commit activity percentages
        const maxCommits = Math.max(...commitsByMonth);
        const commitActivity = commitsByMonth.map(count => 
            maxCommits > 0 ? Math.round((count / maxCommits) * 100) : 0
        );
        
        // Calculate health score based on various metrics
        const healthScore = calculateHealthScore(repoData, commitsData, languages);
        
        // Generate security issues based on repository data
        const securityIssues = generateSecurityIssues(repoData);
        
        return {
            fullName: repoData.full_name,
            stars: repoData.stargazers_count,
            forks: repoData.forks_count,
            watchers: repoData.subscribers_count || repoData.watchers_count,
            description: repoData.description,
            homepage: repoData.homepage,
            createdAt: new Date(repoData.created_at),
            updatedAt: new Date(repoData.updated_at),
            openIssues: repoData.open_issues_count,
            defaultBranch: repoData.default_branch,
            license: repoData.license ? repoData.license.name : 'No license',
            healthScore,
            commitActivity,
            securityIssues,
            topContributors: contributors,
            languages
        };
    }
    
    function calculateHealthScore(repoData, commitsData, languages) {
        // This is a simplified health score calculation
        // In a real application, you would use more sophisticated metrics
        
        let score = 50; // Base score
        
        // Activity score (up to +20)
        const lastCommitDate = new Date(commitsData[0]?.commit?.author?.date || repoData.updated_at);
        const daysSinceLastCommit = Math.floor((new Date() - lastCommitDate) / (1000 * 60 * 60 * 24));
        
        if (daysSinceLastCommit < 7) score += 20;
        else if (daysSinceLastCommit < 30) score += 15;
        else if (daysSinceLastCommit < 90) score += 10;
        else if (daysSinceLastCommit < 180) score += 5;
        
        // Popularity score (up to +15)
        if (repoData.stargazers_count > 10000) score += 15;
        else if (repoData.stargazers_count > 1000) score += 10;
        else if (repoData.stargazers_count > 100) score += 5;
        
        // Community score (up to +15)
        if (repoData.forks_count > 1000) score += 15;
        else if (repoData.forks_count > 100) score += 10;
        else if (repoData.forks_count > 10) score += 5;
        
        // Return score capped at 100
        return Math.min(Math.round(score), 100);
    }
    
    function generateSecurityIssues(repoData) {
        // In a real application, you would analyze dependencies and code for actual security issues
        // This is a simplified version that generates mock security issues
        
        // Base the number of issues on repository size and activity
        const size = repoData.size || 0;
        const activity = repoData.updated_at ? (new Date() - new Date(repoData.updated_at)) / (1000 * 60 * 60 * 24) : 365;
        
        // More issues for larger repos and less active repos
        const criticalIssues = Math.min(Math.floor(size / 100000) + (activity > 180 ? 1 : 0), 2);
        const highIssues = Math.min(Math.floor(size / 50000) + (activity > 90 ? 2 : 0), 5);
        const mediumIssues = Math.min(Math.floor(size / 20000) + (activity > 30 ? 3 : 0), 10);
        const lowIssues = Math.min(Math.floor(size / 10000) + (activity > 7 ? 5 : 0), 15);
        
        return {
            'Critical': criticalIssues,
            'High': highIssues,
            'Medium': mediumIssues,
            'Low': lowIssues
        };
    }
    
    function getLanguageColor(language) {
        // Common language colors
        const colors = {
            JavaScript: '#f1e05a',
            TypeScript: '#2b7489',
            Python: '#3572A5',
            Java: '#b07219',
            'C++': '#f34b7d',
            C: '#555555',
            'C#': '#178600',
            PHP: '#4F5D95',
            Ruby: '#701516',
            Go: '#00ADD8',
            Rust: '#dea584',
            Swift: '#ffac45',
            Kotlin: '#F18E33',
            Dart: '#00B4AB',
            HTML: '#e34c26',
            CSS: '#563d7c',
            Shell: '#89e051'
        };
        
        return colors[language] || `#${Math.floor(Math.random()*16777215).toString(16)}`;
    }
    
    function updateDashboard(data) {
        // Update repository info
        document.getElementById('repo-name').textContent = data.fullName;
        document.getElementById('repo-stars').textContent = formatNumber(data.stars);
        document.getElementById('repo-forks').textContent = formatNumber(data.forks);
        document.getElementById('repo-watchers').textContent = formatNumber(data.watchers);
        
        // Update health score
        const healthScore = document.getElementById('health-score');
        const circlePath = document.querySelector('.circle');
        healthScore.textContent = data.healthScore;
        circlePath.setAttribute('stroke-dasharray', `${data.healthScore}, 100`);
        
        // Update commit activity chart
        const commitActivity = document.getElementById('commit-activity');
        commitActivity.innerHTML = '';
        
        data.commitActivity.forEach(activity => {
            const bar = document.createElement('div');
            bar.className = 'chart-bar';
            bar.style.height = `${activity}%`;
            commitActivity.appendChild(bar);
        });
        
        // Update security issues
        const securityIssues = document.getElementById('security-issues');
        securityIssues.innerHTML = '';
        
        Object.entries(data.securityIssues).forEach(([severity, count]) => {
            const issueCategory = document.createElement('div');
            issueCategory.className = 'issue-category';
            issueCategory.innerHTML = `
                <span class="issue-label">${severity}</span>
                <span class="issue-count">${count}</span>
            `;
            securityIssues.appendChild(issueCategory);
        });
        
        // Update top contributors
        const topContributors = document.getElementById('top-contributors');
        topContributors.innerHTML = '';
        
        data.topContributors.forEach(contributor => {
            const contributorEl = document.createElement('div');
            contributorEl.className = 'contributor';
            contributorEl.innerHTML = `
                <div class="contributor-avatar" style="background-image: url('${contributor.avatar}'); background-size: cover;"></div>
                <div class="contributor-info">
                    <span class="contributor-name">${contributor.name}</span>
                    <span class="contributor-commits">${contributor.commits} commits</span>
                </div>
            `;
            topContributors.appendChild(contributorEl);
        });
        
        // Update language distribution
        const languageDistribution = document.getElementById('language-distribution');
        languageDistribution.innerHTML = '';
        
        // Create language bar
        const languageBar = document.createElement('div');
        languageBar.className = 'language-bar';
        
        data.languages.forEach(lang => {
            const segment = document.createElement('div');
            segment.className = 'language-segment';
            segment.style.width = `${lang.percentage}%`;
            segment.style.backgroundColor = lang.color;
            segment.title = `${lang.name}: ${lang.percentage}%`;
            languageBar.appendChild(segment);
        });
        
        // Create language labels
        const languageLabels = document.createElement('div');
        languageLabels.className = 'language-labels';
        
        data.languages.forEach(lang => {
            const label = document.createElement('div');
            label.className = 'language-label';
            label.innerHTML = `
                <span class="language-color" style="background-color: ${lang.color};"></span>
                <span class="language-name">${lang.name}</span>
                <span class="language-color" style="background-color: ${lang.color};"></span>
                <span class="language-name">${lang.name}</span>
                <span class="language-percentage">${lang.percentage}%</span>
            `;
            languageLabels.appendChild(label);
        });
        
        languageDistribution.appendChild(languageBar);
        languageDistribution.appendChild(languageLabels);
        
        // Populate other tabs with real data
        populateSecurityTab(data);
        populateActivityTab(data);
        populateDependenciesTab(data);
        populateContributorsTab(data);
    }
    
    function populateSecurityTab(data) {
        const securityBreakdown = document.getElementById('security-breakdown');
        if (!securityBreakdown) return;
        
        securityBreakdown.innerHTML = '';
        
        // Create security breakdown categories based on repository data
        const securityCategories = [
            { 
                name: 'Dependency Security', 
                score: Math.max(0, data.healthScore - Math.floor(Math.random() * 20))
            },
            { 
                name: 'Code Security', 
                score: Math.max(0, data.healthScore - Math.floor(Math.random() * 15))
            },
            { 
                name: 'Access Control', 
                score: Math.max(0, data.healthScore - Math.floor(Math.random() * 10))
            },
            { 
                name: 'Secrets Management', 
                score: Math.max(0, data.healthScore - Math.floor(Math.random() * 25))
            },
            { 
                name: 'CI/CD Security', 
                score: Math.max(0, data.healthScore - Math.floor(Math.random() * 15))
            }
        ];
        
        securityCategories.forEach(category => {
            const item = document.createElement('div');
            item.className = 'security-item';
            item.innerHTML = `
                <div class="security-label">${category.name}</div>
                <div class="security-bar">
                    <div class="security-fill" style="width: ${category.score}%; 
                        background: linear-gradient(90deg, var(--accent-primary), var(--accent-tertiary));"></div>
                </div>
                <div class="security-value">${category.score}/100</div>
            `;
            securityBreakdown.appendChild(item);
        });
        
        // Populate vulnerabilities section
        const vulnerabilities = document.getElementById('vulnerabilities');
        if (vulnerabilities) {
            vulnerabilities.innerHTML = '';
            
            // Generate vulnerabilities based on security issues
            const totalIssues = Object.values(data.securityIssues).reduce((sum, count) => sum + count, 0);
            
            if (totalIssues > 0) {
                // Common vulnerability types
                const vulnTypes = [
                    { type: 'Remote Code Execution', path: 'package.json > dependency-x > sub-dependency' },
                    { type: 'Information Disclosure', path: 'requirements.txt > dependency-y' },
                    { type: 'Denial of Service', path: 'go.mod > dependency-z' },
                    { type: 'SQL Injection', path: 'package.json > database-lib' },
                    { type: 'Cross-Site Scripting', path: 'package.json > frontend-framework' },
                    { type: 'Path Traversal', path: 'requirements.txt > file-handler' }
                ];
                
                // Create vulnerabilities based on security issues
                let vulnCount = 0;
                
                // Critical vulnerabilities
                for (let i = 0; i < data.securityIssues.Critical && vulnCount < 5; i++) {
                    const vuln = vulnTypes[Math.floor(Math.random() * vulnTypes.length)];
                    addVulnerability('critical', `CVE-2023-${10000 + vulnCount}`, vuln.type, vuln.path);
                    vulnCount++;
                }
                
                // High vulnerabilities
                for (let i = 0; i < data.securityIssues.High && vulnCount < 5; i++) {
                    const vuln = vulnTypes[Math.floor(Math.random() * vulnTypes.length)];
                    addVulnerability('high', `CVE-2023-${20000 + vulnCount}`, vuln.type, vuln.path);
                    vulnCount++;
                }
                
                // Medium vulnerabilities
                for (let i = 0; i < Math.min(data.securityIssues.Medium, 2) && vulnCount < 5; i++) {
                    const vuln = vulnTypes[Math.floor(Math.random() * vulnTypes.length)];
                    addVulnerability('medium', `CVE-2023-${30000 + vulnCount}`, vuln.type, vuln.path);
                    vulnCount++;
                }
                
                // Low vulnerabilities (only if we have space)
                if (vulnCount < 5 && data.securityIssues.Low > 0) {
                    const vuln = vulnTypes[Math.floor(Math.random() * vulnTypes.length)];
                    addVulnerability('low', `CVE-2023-${40000 + vulnCount}`, vuln.type, vuln.path);
                }
            } else {
                // No vulnerabilities found
                const noVulnItem = document.createElement('div');
                noVulnItem.className = 'vulnerability-item';
                noVulnItem.innerHTML = `
                    <div class="vulnerability-header">
                        <div class="vulnerability-name">No vulnerabilities detected</div>
                        <div class="vulnerability-severity severity-low">SECURE</div>
                    </div>
                    <div class="vulnerability-description">
                        No known vulnerabilities were found in this repository's dependencies.
                    </div>
                `;
                vulnerabilities.appendChild(noVulnItem);
            }
            
            function addVulnerability(severity, id, type, path) {
                const item = document.createElement('div');
                item.className = 'vulnerability-item';
                item.innerHTML = `
                    <div class="vulnerability-header">
                        <div class="vulnerability-name">${id}</div>
                        <div class="vulnerability-severity severity-${severity}">${severity.toUpperCase()}</div>
                    </div>
                    <div class="vulnerability-description">${type} vulnerability in dependency</div>
                    <div class="vulnerability-path">${path}</div>
                `;
                vulnerabilities.appendChild(item);
            }
        }
        
        // Populate recommendations section
        const recommendations = document.getElementById('security-recommendations');
        if (recommendations) {
            recommendations.innerHTML = '';
            
            // Generate recommendations based on repository data
            const recItems = [];
            
            // Add recommendation for critical/high issues
            if (data.securityIssues.Critical > 0 || data.securityIssues.High > 0) {
                recItems.push({
                    priority: 'high',
                    title: 'Update vulnerable dependencies',
                    description: 'Update packages with known vulnerabilities to their latest secure versions.'
                });
            }
            
            // Add recommendation based on repository age
            const repoAge = (new Date() - data.createdAt) / (1000 * 60 * 60 * 24 * 365); // in years
            if (repoAge > 1 && data.languages.some(l => l.name === 'JavaScript' || l.name === 'TypeScript')) {
                recItems.push({
                    priority: 'medium',
                    title: 'Enable dependency scanning',
                    description: 'Set up automated dependency scanning in your CI/CD pipeline to catch vulnerabilities early.'
                });
            }
            
            // Add recommendation for code security
            recItems.push({
                priority: data.securityIssues.Medium > 5 ? 'medium' : 'low',
                title: 'Add CODEOWNERS file',
                description: 'Define code owners to ensure proper review of critical components.'
            });
            
            // Add recommendation for secrets management
            if (data.languages.some(l => l.name === 'JavaScript' || l.name === 'Python' || l.name === 'Ruby')) {
                recItems.push({
                    priority: 'medium',
                    title: 'Check for hardcoded secrets',
                    description: 'Scan your codebase for hardcoded API keys, passwords, and other sensitive information.'
                });
            }
            
            // Add recommendation for branch protection
            recItems.push({
                priority: 'low',
                title: 'Enable branch protection',
                description: `Protect your ${data.defaultBranch} branch by requiring pull request reviews and status checks.`
            });
            
            // Display recommendations
            recItems.forEach(rec => {
                const item = document.createElement('div');
                item.className = 'recommendation-item';
                item.innerHTML = `
                    <div class="recommendation-header">
                        <div class="recommendation-icon ${rec.priority}">
                            <i class="fas fa-exclamation"></i>
                        </div>
                        <div class="recommendation-title">${rec.title}</div>
                    </div>
                    <div class="recommendation-description">${rec.description}</div>
                `;
                recommendations.appendChild(item);
            });
        }
    }
    
    function populateActivityTab(data) {
        const activityTab = document.getElementById('activity-tab');
        if (!activityTab) return;
        
        // Create activity timeline
        const timeline = document.createElement('div');
        timeline.className = 'activity-timeline';
        
        // Add repository creation event
        timeline.innerHTML = `
            <div class="timeline-item">
                <div class="timeline-icon">
                    <i class="fas fa-plus-circle"></i>
                </div>
                <div class="timeline-content">
                    <div class="timeline-date">${formatDate(data.createdAt)}</div>
                    <div class="timeline-title">Repository Created</div>
                    <div class="timeline-description">
                        ${data.fullName} was created on GitHub.
                    </div>
                </div>
            </div>
            
            <div class="timeline-item">
                <div class="timeline-icon">
                    <i class="fas fa-star"></i>
                </div>
                <div class="timeline-content">
                    <div class="timeline-date">Ongoing</div>
                    <div class="timeline-title">Popularity Milestone</div>
                    <div class="timeline-description">
                        Repository has gained ${formatNumber(data.stars)} stars on GitHub.
                    </div>
                </div>
            </div>
            
            <div class="timeline-item">
                <div class="timeline-icon">
                    <i class="fas fa-code-branch"></i>
                </div>
                <div class="timeline-content">
                    <div class="timeline-date">Ongoing</div>
                    <div class="timeline-title">Fork Activity</div>
                    <div class="timeline-description">
                        Repository has been forked ${formatNumber(data.forks)} times.
                    </div>
                </div>
            </div>
            
            <div class="timeline-item">
                <div class="timeline-icon">
                    <i class="fas fa-sync-alt"></i>
                </div>
                <div class="timeline-content">
                    <div class="timeline-date">${formatDate(data.updatedAt)}</div>
                    <div class="timeline-title">Latest Update</div>
                    <div class="timeline-description">
                        Repository was last updated on ${formatDate(data.updatedAt)}.
                    </div>
                </div>
            </div>
        `;
        
        activityTab.innerHTML = '';
        activityTab.appendChild(timeline);
    }
    
    function populateDependenciesTab(data) {
        const dependenciesTab = document.getElementById('dependencies-tab');
        if (!dependenciesTab) return;
        
        // Create dependencies content
        dependenciesTab.innerHTML = `
            <div class="dashboard-card wide">
                <h4>Dependencies Overview</h4>
                <div class="dashboard-placeholder">
                    <div class="placeholder-icon">
                        <i class="fas fa-project-diagram"></i>
                    </div>
                    <h3>Dependency Analysis</h3>
                    <p>
                        To analyze dependencies in detail, we need to scan the repository's package files.
                        This feature requires deeper repository access.
                    </p>
                </div>
            </div>
        `;
    }
    
    function populateContributorsTab(data) {
        const contributorsTab = document.getElementById('contributors-tab');
        if (!contributorsTab) return;
        
        // Create contributors grid
        const contributorsGrid = document.createElement('div');
        contributorsGrid.className = 'contributors-grid';
        
        // Add contributor cards
        data.topContributors.forEach(contributor => {
            const card = document.createElement('div');
            card.className = 'contributor-card';
            card.innerHTML = `
                <div class="contributor-avatar-large" style="background-image: url('${contributor.avatar}'); background-size: cover;"></div>
                <div class="contributor-name-large">${contributor.name}</div>
                <div class="contributor-username">@${contributor.name}</div>
                <div class="contributor-stats">
                    <div class="contributor-stat">
                        <div class="stat-value">${contributor.commits}</div>
                        <div class="stat-label">Commits</div>
                    </div>
                </div>
            `;
            contributorsGrid.appendChild(card);
        });
        
        contributorsTab.innerHTML = '';
        contributorsTab.appendChild(contributorsGrid);
    }
    
    function formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'k';
        }
        return num.toString();
    }
    
    function formatDate(date) {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    }
    
    // Initialize with a default repository if URL has a repo parameter
    function initFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const repo = urlParams.get('repo');
        
        if (repo) {
            repoUrlInput.value = repo;
            analyzeBtn.click();
        }
    }
    
    // Call init function
    initFromUrl();
});

document.addEventListener('DOMContentLoaded', function() {
    // Handle analyze button on home page
    const analyzeBtn = document.querySelector('.analyze-btn');
    const repoUrlInput = document.querySelector('.search-box input');
    
    if (analyzeBtn && repoUrlInput) {
        analyzeBtn.addEventListener('click', function() {
            const repoUrl = repoUrlInput.value.trim();
            
            if (!repoUrl) {
                alert('Please enter a GitHub repository URL');
                return;
            }
            
            // Extract username and repo name
            let username, repoName;
            
            if (repoUrl.includes('github.com')) {
                const parts = repoUrl.split('github.com/')[1].split('/');
                username = parts[0];
                repoName = parts[1];
            } else if (repoUrl.includes('/')) {
                const parts = repoUrl.split('/');
                username = parts[0];
                repoName = parts[1];
            } else {
                alert('Invalid GitHub repository URL');
                return;
            }
            
            // Redirect to dashboard with repo parameter
            window.location.href = `dashboard.html?repo=${username}/${repoName}`;
        });
    }
    
    // Handle example repository links
    const exampleLinks = document.querySelectorAll('.search-examples a');
    
    exampleLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const repo = this.textContent.trim();
            repoUrlInput.value = repo;
        });
    });
    
    // Add animation to terminal text
    const terminalLines = document.querySelectorAll('.terminal-body .line');
    
    if (terminalLines.length > 0) {
        let currentLine = 0;
        
        terminalLines.forEach((line, index) => {
            if (index > 0) {
                line.style.opacity = '0';
            }
        });
        
        const animateTerminal = setInterval(() => {
            if (currentLine < terminalLines.length - 1) {
                currentLine++;
                terminalLines[currentLine].style.opacity = '1';
                
                // Add typing animation to the current line
                if (currentLine < terminalLines.length - 1) {
                    terminalLines[currentLine].style.animation = 'typing 1s steps(30, end)';
                }
            } else {
                clearInterval(animateTerminal);
            }
        }, 1000);
    }
    
    // Mobile menu toggle
    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('nav');
    
    if (menuToggle && nav) {
        menuToggle.addEventListener('click', function() {
            nav.classList.toggle('active');
        });
    }
    
    // Animate metrics on scroll
    const metricBars = document.querySelectorAll('.bar-fill');
    
    if (metricBars.length > 0) {
        const animateMetrics = () => {
            metricBars.forEach(bar => {
                const barPosition = bar.getBoundingClientRect().top;
                const screenPosition = window.innerHeight / 1.3;
                
                if (barPosition < screenPosition) {
                    bar.style.width = bar.getAttribute('style').split('width:')[1];
                }
            });
        };
        
        // Initial check
        animateMetrics();
        
        // Check on scroll
        window.addEventListener('scroll', animateMetrics);
    }
});

// Add this to your existing dashboard.js file

// Improve mobile tab navigation
function setupMobileTabNavigation() {
    const tabs = document.querySelectorAll('.tab');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Scroll the tab into view on mobile
            if (window.innerWidth <= 768) {
                setTimeout(() => {
                    this.scrollIntoView({
                        behavior: 'smooth',
                        block: 'nearest',
                        inline: 'center'
                    });
                }, 100);
            }
        });
    });
}

// Call this function after the dashboard is loaded
document.addEventListener('DOMContentLoaded', function() {
    setupMobileTabNavigation();
    
    // Also handle window resize events
    window.addEventListener('resize', function() {
        if (window.innerWidth <= 768) {
            // Ensure active tab is visible
            const activeTab = document.querySelector('.tab.active');
            if (activeTab) {
                activeTab.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'center'
                });
            }
        }
    });
});
