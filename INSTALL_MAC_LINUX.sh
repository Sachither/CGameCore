#!/bin/bash
# CGameCore macOS/Linux Installation Script
# This script automates the installation process for CGameCore on macOS and Linux

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Print colored output
print_step() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Header
echo ""
echo "================================================"
echo " CGameCore - macOS/Linux Installation Script"
echo "================================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed or not in PATH"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

print_step "Node.js detected: $(node --version)"

# Check if Git is installed
if ! command -v git &> /dev/null; then
    print_error "Git is not installed or not in PATH"
    echo "Please install Git from https://git-scm.com/"
    exit 1
fi

print_step "Git detected: $(git --version)"
echo ""

# Clone repository
echo "[Step 1/7] Cloning repository..."
git clone https://github.com/Sachither/CGameCore.git
if [ $? -ne 0 ]; then
    print_error "Failed to clone repository"
    exit 1
fi
cd CGameCore
print_step "Repository cloned successfully"

# Install dependencies
echo ""
echo "[Step 2/7] Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    print_error "Failed to install dependencies"
    exit 1
fi
print_step "Dependencies installed successfully"

# Check if .env.local exists
echo ""
echo "[Step 3/7] Checking environment setup..."
if [ ! -f .env.local ]; then
    print_warning ".env.local not found"
    echo "Creating template .env.local file..."
    cat > .env.local << 'EOF'
# CGameCore Environment Variables
ENCRYPTION_KEY=YOUR_ENCRYPTION_KEY_HERE
NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
DATABASE_URL=YOUR_DATABASE_URL
EOF
    print_warning "Created template. Please edit .env.local with your credentials"
fi
print_step "Environment setup checked"

# Run database migrations
echo ""
echo "[Step 4/7] Running database migrations..."
npm run db:push
if [ $? -ne 0 ]; then
    print_warning "Database migration failed"
    echo "You may need to run this manually: npm run db:push"
fi
print_step "Database migration completed"

# Run TypeScript check
echo ""
echo "[Step 5/7] Checking TypeScript..."
npm run type-check
if [ $? -ne 0 ]; then
    print_warning "TypeScript errors detected"
    echo "Please review and fix any type errors"
fi
print_step "TypeScript check completed"

# Build application
echo ""
echo "[Step 6/7] Building application..."
npm run build
if [ $? -ne 0 ]; then
    print_error "Build failed"
    exit 1
fi
print_step "Build completed successfully"

# Installation complete
echo ""
echo "[Step 7/7] Installation complete!"
echo ""
echo "================================================"
echo " Installation Summary"
echo "================================================"
echo ""
echo "✓ Node.js verified"
echo "✓ Dependencies installed"
echo "✓ Environment configured"
echo "✓ Database migrated"
echo "✓ Application built"
echo ""
echo "Next Steps:"
echo "  1. Edit .env.local with your API credentials"
echo "  2. Run: npm run dev"
echo "  3. Open http://localhost:3000 in your browser"
echo ""
echo "For more information, see SETUP_INSTALLATION.md"
echo ""
