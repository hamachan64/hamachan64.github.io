document.addEventListener('DOMContentLoaded', () => {
    // Custom Cursor Logic Removed


    // Hover effect for links
    document.querySelectorAll('a, button, .work-card').forEach(el => {
        el.addEventListener('mouseenter', () => {
            cursorOutline.style.backgroundColor = 'rgba(0, 243, 255, 0.1)';
        });
        el.addEventListener('mouseleave', () => {
            cursorOutline.style.width = '40px';
            cursorOutline.style.height = '40px';
            cursorOutline.style.backgroundColor = 'transparent';
        });
    });

    // Intersection Observer for fade-in animations
    const observerOptions = {
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    document.querySelectorAll('.section').forEach(section => {
        section.classList.add('fade-in-section'); // Add initial class
        observer.observe(section);
    });
});
